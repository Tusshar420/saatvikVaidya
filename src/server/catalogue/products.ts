import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import {
  CATALOGUE_PAGE_SIZE,
  catalogueSorts,
  productImageSrc,
  productSlugPattern,
  type CatalogueSort,
} from "@/lib/catalogue";
import { db } from "@/server/db";
import { sellableByProduct, sellableOf, sweepLapsedHolds } from "@/server/inventory/availability";
import {
  basePriceColumn,
  priceFor,
  type PricingViewer,
  type ViewerPrice,
} from "@/server/pricing";

// The public catalogue: the listing with filters, search and the product
// page. Only active products are shown. Prices come from priceFor(), and the
// objects returned here hold only the viewer's own price, never the stored
// professional price or bulk tiers, so they're safe to hand to any page or
// client component.

// ─── Filters ────────────────────────────────────────────────────────────────

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const keyParam = z
  .preprocess(first, z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,64}$/).optional())
  .catch(undefined);

/**
 * Filters from the URL. Anything invalid is dropped rather than failing, so
 * an old or mistyped link still shows products.
 */
export const catalogueFiltersSchema = z.object({
  q: z
    .preprocess(first, z.string().trim().max(100).optional())
    .transform((value) => value || undefined)
    .catch(undefined),
  form: keyParam,
  area: keyParam,
  brand: keyParam,
  sort: z.preprocess(first, z.enum(catalogueSorts)).catch("featured"),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000)).catch(1),
});

export type CatalogueFilters = z.infer<typeof catalogueFiltersSchema>;

// ─── Types returned to pages ────────────────────────────────────────────────

export type ProductImageView = { src: string; alt: string };

/** What the listing shows for the viewer: no stored prices besides MRP. */
export type ProductCard = {
  id: number;
  slug: string;
  name: string;
  brandName: string | null;
  formName: string;
  glyph: string | null;
  packSize: string;
  isSample: boolean;
  inStock: boolean;
  moq: number;
  image: ProductImageView | null;
  price: Pick<ViewerPrice, "unitPaise" | "mrpPaise" | "tier">;
};

export type FacetOption = { key: string; name: string };

export type CatalogueFacets = {
  forms: FacetOption[];
  areas: FacetOption[];
  brands: FacetOption[];
};

export type CatalogueListing = {
  /** The filters in use, with unknown keys dropped. */
  filters: CatalogueFilters;
  products: ProductCard[];
  total: number;
  page: number;
  pageCount: number;
  facets: CatalogueFacets;
};

export type StockStatus = { kind: "in" } | { kind: "low"; left: number } | { kind: "out" };

export type ProductPage = {
  /** For "Add to cart". */
  id: number;
  slug: string;
  name: string;
  brand: FacetOption | null;
  form: FacetOption & { glyph: string | null };
  practiceAreas: FacetOption[];
  description: string;
  ingredients: string | null;
  dosage: string | null;
  packSize: string;
  gstRate: number;
  hsnCode: string;
  moq: number;
  stock: StockStatus;
  isSample: boolean;
  images: ProductImageView[];
  /** The viewer's price; bulkTiers is empty unless they get bulk prices. */
  price: ViewerPrice;
  viewer: PricingViewer["kind"];
};

// ─── Reading ────────────────────────────────────────────────────────────────

const byOrder = [{ sortOrder: "asc" as const }, { id: "asc" as const }];

/** Active forms, practice areas and brands, for the filter choices. */
export async function readFacets(): Promise<CatalogueFacets> {
  const [categories, brands] = await Promise.all([
    db.category.findMany({
      where: { active: true },
      orderBy: byOrder,
      select: { key: true, name: true, kind: true },
    }),
    db.brand.findMany({
      where: { active: true },
      orderBy: byOrder,
      select: { key: true, name: true },
    }),
  ]);
  const option = (c: { key: string; name: string }) => ({ key: c.key, name: c.name });
  return {
    forms: categories.filter((c) => c.kind === "FORM").map(option),
    areas: categories.filter((c) => c.kind === "PRACTICE_AREA").map(option),
    brands: brands.map(option),
  };
}

/** Up to five words; every word must match the name, brand, form, area or ingredients. */
export function searchWhere(q: string | undefined): Prisma.ProductWhereInput {
  const words = (q ?? "").split(/\s+/).filter(Boolean).slice(0, 5);
  if (words.length === 0) return {};
  return {
    AND: words.map((word) => ({
      OR: [
        { name: { contains: word } },
        { brand: { is: { name: { contains: word } } } },
        { form: { is: { name: { contains: word } } } },
        { practiceAreas: { some: { name: { contains: word } } } },
        { ingredients: { contains: word } },
      ],
    })),
  };
}

function orderFor(
  sort: CatalogueSort,
  viewer: PricingViewer,
): Prisma.ProductOrderByWithRelationInput[] {
  const byPrice = (direction: "asc" | "desc"): Prisma.ProductOrderByWithRelationInput[] => [
    basePriceColumn(viewer) === "mrpPaise"
      ? { mrpPaise: direction }
      : { professionalPricePaise: direction },
    { id: "asc" },
  ];
  switch (sort) {
    case "price-asc":
      return byPrice("asc");
    case "price-desc":
      return byPrice("desc");
    case "name":
      return [{ name: "asc" }, { id: "asc" }];
    case "newest":
      return [{ createdAt: "desc" }, { id: "desc" }];
    case "featured":
      return [{ featured: "desc" }, { sortOrder: "asc" }, { id: "asc" }];
  }
}

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  packSize: true,
  isSample: true,
  moq: true,
  mrpPaise: true,
  professionalPricePaise: true,
  bulkTiers: { select: { minQuantity: true, pricePaise: true } },
  brand: { select: { name: true } },
  form: { select: { name: true, glyph: true } },
  images: {
    orderBy: byOrder,
    take: 1,
    select: { id: true, alt: true },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

function toCard(row: CardRow, stock: number, viewer: PricingViewer): ProductCard {
  const { unitPaise, mrpPaise, tier } = priceFor(row, viewer);
  const image = row.images[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brandName: row.brand?.name ?? null,
    formName: row.form.name,
    glyph: row.form.glyph,
    packSize: row.packSize,
    isSample: row.isSample,
    inStock: stock >= Math.max(1, row.moq),
    moq: row.moq,
    image: image ? { src: productImageSrc(image.id), alt: image.alt } : null,
    price: { unitPaise, mrpPaise, tier },
  };
}

/**
 * One page of active products for the viewer. Filter keys that don't match
 * an active form, practice area or brand are dropped. A page past the end
 * shows the last page.
 */
export async function listCatalogue(
  input: CatalogueFilters,
  viewer: PricingViewer,
): Promise<CatalogueListing> {
  const facets = await readFacets();
  const known = (options: FacetOption[], key: string | undefined) =>
    key && options.some((option) => option.key === key) ? key : undefined;
  const filters: CatalogueFilters = {
    ...input,
    form: known(facets.forms, input.form),
    area: known(facets.areas, input.area),
    brand: known(facets.brands, input.brand),
  };

  const where: Prisma.ProductWhereInput = {
    active: true,
    ...(filters.form && { form: { is: { key: filters.form } } }),
    ...(filters.brand && { brand: { is: { key: filters.brand } } }),
    ...(filters.area && { practiceAreas: { some: { key: filters.area } } }),
    ...searchWhere(filters.q),
  };

  const total = await db.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / CATALOGUE_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = await db.product.findMany({
    where,
    orderBy: orderFor(filters.sort, viewer),
    skip: (page - 1) * CATALOGUE_PAGE_SIZE,
    take: CATALOGUE_PAGE_SIZE,
    select: cardSelect,
  });

  await sweepLapsedHolds();
  const sellable = await sellableByProduct(rows.map((row) => row.id));
  return {
    filters: { ...filters, page },
    products: rows.map((row) => toCard(row, sellable.get(row.id) ?? 0, viewer)),
    total,
    page,
    pageCount,
    facets,
  };
}

/** Low-stock warning from this many units down. */
const LOW_STOCK = 10;

function stockStatus(stock: number, moq: number): StockStatus {
  if (stock < Math.max(1, moq)) return { kind: "out" };
  if (stock <= LOW_STOCK) return { kind: "low", left: stock };
  return { kind: "in" };
}

/** An active product for the viewer, or null (unknown, hidden or bad slug). */
export async function readProductPage(
  slug: string,
  viewer: PricingViewer,
): Promise<ProductPage | null> {
  if (slug.length > 120 || !productSlugPattern.test(slug)) return null;
  const row = await db.product.findFirst({
    where: { slug, active: true },
    include: {
      brand: { select: { key: true, name: true } },
      form: { select: { key: true, name: true, glyph: true } },
      practiceAreas: {
        where: { active: true },
        orderBy: byOrder,
        select: { key: true, name: true },
      },
      images: { orderBy: byOrder, select: { id: true, alt: true } },
      bulkTiers: { select: { minQuantity: true, pricePaise: true } },
    },
  });
  if (!row) return null;
  await sweepLapsedHolds();
  const stock = await sellableOf(row.id);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    form: row.form,
    practiceAreas: row.practiceAreas,
    description: row.description,
    ingredients: row.ingredients,
    dosage: row.dosage,
    packSize: row.packSize,
    gstRate: row.gstRate,
    hsnCode: row.hsnCode,
    moq: row.moq,
    stock: stockStatus(stock, row.moq),
    isSample: row.isSample,
    images: row.images.map((image) => ({
      src: productImageSrc(image.id),
      alt: image.alt,
    })),
    price: priceFor(row, viewer),
    viewer: viewer.kind,
  };
}

/** Name and description for the product page's metadata (active only). */
export async function readProductMeta(slug: string) {
  if (slug.length > 120 || !productSlugPattern.test(slug)) return null;
  return db.product.findFirst({
    where: { slug, active: true },
    select: { name: true, description: true },
  });
}

/**
 * An image the viewer may load: any image of an active product, and for
 * admins also images of hidden products (for the admin preview).
 */
export async function findServableProductImage(id: number, isAdmin: boolean) {
  const image = await db.productImage.findUnique({
    where: { id },
    select: {
      fileKey: true,
      contentType: true,
      product: { select: { active: true } },
    },
  });
  if (!image || (!image.product.active && !isAdmin)) return null;
  return { fileKey: image.fileKey, contentType: image.contentType, public: image.product.active };
}
