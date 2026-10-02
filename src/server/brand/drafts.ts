import "server-only";
import { z } from "zod";
import { brand as copy } from "@/content/brand";
import type { Prisma } from "@/generated/prisma/client";
import {
  brandLogoUpload,
  brandSorts,
  type BrandSort,
  brandTermsOf,
  isValidBrandQuantity,
  type BrandTerms,
} from "@/lib/brand";
import { CATALOGUE_PAGE_SIZE, productImageSrc } from "@/lib/catalogue";
import { searchWhere } from "@/server/catalogue/products";
import { fieldErrorsOf } from "@/server/admin/form";
import { db } from "@/server/db";
import { deleteFilesQuietly, getStorage, newFileKey } from "@/server/storage";
import { checkUpload, cleanFileName } from "@/server/storage/files";
import { packagingSchema, type PackagingInput } from "./packaging";

// Launch Your Brand drafts (docs/CHUNKS.md, P2.1): the order a signed-in
// user is putting together on /launch, saved after each step. One per user.
// Callers check the session and pass the signed-in user's id; nothing here
// trusts the browser, and every step is checked again when the order is
// placed (./orders.ts).

// ─── Products ───────────────────────────────────────────────────────────────

/** Products that can be ordered in the buyer's packaging right now. */
export const brandProductWhere = {
  active: true,
  brandEligible: true,
  brandMinQty: { gte: 1 },
  brandUnitPricePaise: { gte: 1 },
  brandUnitLabel: { not: null },
} satisfies Prisma.ProductWhereInput;

const brandProductSelect = {
  id: true,
  slug: true,
  name: true,
  packSize: true,
  gstRate: true,
  active: true,
  brandEligible: true,
  brandMinQty: true,
  brandUnitPricePaise: true,
  brandUnitLabel: true,
  form: { select: { key: true, name: true, glyph: true } },
  brand: { select: { name: true } },
  images: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    take: 1,
    select: { id: true, alt: true },
  },
} satisfies Prisma.ProductSelect;

type BrandProductRow = Prisma.ProductGetPayload<{ select: typeof brandProductSelect }>;

export type BrandProduct = {
  id: number;
  slug: string;
  name: string;
  packSize: string;
  gstRate: number;
  formKey: string;
  formName: string;
  glyph: string | null;
  makerName: string | null;
  image: { src: string; alt: string } | null;
  terms: BrandTerms;
};

function toBrandProduct(row: BrandProductRow): BrandProduct | null {
  const terms = row.active ? brandTermsOf(row) : null;
  if (!terms) return null;
  const image = row.images[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    packSize: row.packSize,
    gstRate: row.gstRate,
    formKey: row.form.key,
    formName: row.form.name,
    glyph: row.form.glyph,
    makerName: row.brand?.name ?? null,
    image: image ? { src: productImageSrc(image.id), alt: image.alt } : null,
    terms,
  };
}

/** Products per page on step 1. */
export const BRAND_PRODUCTS_PAGE_SIZE = CATALOGUE_PAGE_SIZE;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const keyParam = z
  .preprocess(first, z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,64}$/).optional())
  .catch(undefined);
const rupeesParam = z
  .preprocess(first, z.coerce.number().int().min(0).max(10_000_000).optional())
  .catch(undefined);

/** Step 1's filters from the URL; anything invalid is dropped, not an error. */
export const brandFiltersSchema = z.object({
  q: z
    .preprocess(first, z.string().trim().max(100).optional())
    .transform((value) => value || undefined)
    .catch(undefined),
  form: keyParam,
  area: keyParam,
  maker: keyParam,
  minPrice: rupeesParam,
  maxPrice: rupeesParam,
  sort: z.preprocess(first, z.enum(brandSorts)).catch("featured"),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000)).catch(1),
});

export type BrandFilterOption = { key: string; name: string };

export type BrandProductFilters = {
  q?: string;
  form?: string;
  area?: string;
  maker?: string;
  /** Branded price range in whole rupees, both ends included. */
  minPrice?: number;
  maxPrice?: number;
  sort?: BrandSort;
  page?: number;
};

export type BrandProductListing = {
  /** The filters in use, with unknown keys and a flipped or out-of-range price dropped. */
  filters: Required<Pick<BrandProductFilters, "sort" | "page">> &
    Omit<BrandProductFilters, "sort" | "page">;
  products: BrandProduct[];
  /** Products matching the filters, over all pages. */
  total: number;
  page: number;
  pageCount: number;
  /** Choices that have at least one eligible product, for the filters. */
  forms: BrandFilterOption[];
  areas: BrandFilterOption[];
  makers: BrandFilterOption[];
  /** Cheapest and dearest branded price among all eligible products, in whole rupees. */
  priceRange: { min: number; max: number };
  /** Eligible products in all, before any filter. */
  totalEligible: number;
};

function brandOrderFor(sort: BrandSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ brandUnitPricePaise: "asc" }, { id: "asc" }];
    case "price-desc":
      return [{ brandUnitPricePaise: "desc" }, { id: "asc" }];
    case "name":
      return [{ name: "asc" }, { id: "asc" }];
    case "newest":
      return [{ createdAt: "desc" }, { id: "desc" }];
    case "featured":
      return [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }];
  }
}

/** Eligible products for step 1, filtered, sorted and paged like the store listing. */
export async function listBrandProducts(
  filters: BrandProductFilters,
): Promise<BrandProductListing> {
  const all = await db.product.findMany({
    where: brandProductWhere,
    select: {
      brandUnitPricePaise: true,
      form: { select: { key: true, name: true, sortOrder: true, id: true } },
      brand: { select: { key: true, name: true } },
      practiceAreas: {
        where: { active: true },
        select: { key: true, name: true, sortOrder: true, id: true },
      },
    },
  });
  const byOrder = <T extends { sortOrder: number; id: number }>(a: T, b: T) =>
    a.sortOrder - b.sortOrder || a.id - b.id;
  const options = <T extends { key: string; name: string; sortOrder: number; id: number }>(
    items: T[],
  ): BrandFilterOption[] =>
    [...new Map(items.map((item) => [item.key, item])).values()]
      .sort(byOrder)
      .map(({ key, name }) => ({ key, name }));
  const forms = options(all.map((row) => row.form));
  const areas = options(all.flatMap((row) => row.practiceAreas));
  const makers = [
    ...new Map(all.flatMap((row) => (row.brand ? [[row.brand.key, row.brand] as const] : []))).values(),
  ]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ key, name }) => ({ key, name }));

  const prices = all.map((row) => (row.brandUnitPricePaise ?? 0) / 100);
  const priceRange = prices.length
    ? { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) }
    : { min: 0, max: 0 };

  const known = (list: BrandFilterOption[], key: string | undefined) =>
    key && list.some((option) => option.key === key) ? key : undefined;
  // A price at the end of the range is the same as no limit.
  let minPrice = filters.minPrice !== undefined && filters.minPrice > priceRange.min ? filters.minPrice : undefined;
  let maxPrice = filters.maxPrice !== undefined && filters.maxPrice < priceRange.max ? filters.maxPrice : undefined;
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  const used = {
    q: filters.q,
    form: known(forms, filters.form),
    area: known(areas, filters.area),
    maker: known(makers, filters.maker),
    minPrice,
    maxPrice,
    sort: filters.sort ?? "featured",
  };

  const where: Prisma.ProductWhereInput = {
    ...brandProductWhere,
    ...(used.form && { form: { is: { key: used.form } } }),
    ...(used.area && { practiceAreas: { some: { key: used.area } } }),
    ...(used.maker && { brand: { is: { key: used.maker } } }),
    // Rupees are whole numbers in the filter, so the top is inclusive up to ₹x.99.
    ...((minPrice !== undefined || maxPrice !== undefined) && {
      brandUnitPricePaise: {
        gte: Math.max(1, (minPrice ?? 0) * 100),
        ...(maxPrice !== undefined && { lt: (maxPrice + 1) * 100 }),
      },
    }),
    ...searchWhere(used.q),
  };
  const total = await db.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / BRAND_PRODUCTS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = await db.product.findMany({
    where,
    orderBy: brandOrderFor(used.sort),
    skip: (page - 1) * BRAND_PRODUCTS_PAGE_SIZE,
    take: BRAND_PRODUCTS_PAGE_SIZE,
    select: brandProductSelect,
  });
  return {
    filters: { ...used, page },
    products: rows.flatMap((row) => toBrandProduct(row) ?? []),
    total,
    page,
    pageCount,
    forms,
    areas,
    makers,
    priceRange,
    totalEligible: all.length,
  };
}

/** One eligible product, or null (unknown, hidden or not open for branding). */
export async function findBrandProduct(
  productId: number,
  client: Prisma.TransactionClient = db,
): Promise<BrandProduct | null> {
  const row = await client.product.findUnique({
    where: { id: productId },
    select: brandProductSelect,
  });
  return row ? toBrandProduct(row) : null;
}

// ─── Drafts ─────────────────────────────────────────────────────────────────

export type DraftLogo = {
  name: string;
  contentType: string;
  sizeBytes: number;
};

export type BrandDraftView = {
  /** The chosen product, if it is still open for branded orders. */
  product: BrandProduct | null;
  /** True when a product was chosen but is no longer available. */
  productGone: boolean;
  packaging: Record<keyof PackagingInput, string | null>;
  packagingDone: boolean;
  logo: DraftLogo | null;
  quantity: number | null;
  updatedAt: Date;
};

/** The furthest step the draft may open: each step needs the ones before it. */
export function furthestStep(draft: BrandDraftView | null): number {
  if (!draft?.product) return 1;
  if (!draft.packagingDone || !draft.logo) return 2;
  if (draft.quantity === null || !isValidBrandQuantity(draft.quantity, draft.product.terms)) {
    return 3;
  }
  return 4;
}

export async function readDraft(userId: string): Promise<BrandDraftView | null> {
  const draft = await db.brandDraft.findUnique({
    where: { userId },
    include: { product: { select: brandProductSelect } },
  });
  if (!draft) return null;
  const product = draft.product ? toBrandProduct(draft.product) : null;
  return {
    product,
    productGone: draft.productId !== null && product === null,
    packaging: {
      brandName: draft.brandName,
      tagline: draft.tagline,
      marketedByName: draft.marketedByName,
      marketedByAddress: draft.marketedByAddress,
      contactPhone: draft.contactPhone,
      notes: draft.notes,
    },
    packagingDone: draft.packagingDone,
    logo:
      draft.logoKey && draft.logoName && draft.logoContentType && draft.logoSizeBytes !== null
        ? { name: draft.logoName, contentType: draft.logoContentType, sizeBytes: draft.logoSizeBytes }
        : null,
    quantity: draft.quantity,
    updatedAt: draft.updatedAt,
  };
}

/**
 * Step 1: picks the product. Choosing a different product clears the
 * quantity, since its minimum differs. False if the product isn't open
 * for branded orders.
 */
export async function chooseBrandProduct(userId: string, productId: number): Promise<boolean> {
  const product = await findBrandProduct(productId);
  if (!product) return false;
  const existing = await db.brandDraft.findUnique({
    where: { userId },
    select: { productId: true },
  });
  const changed = existing?.productId !== productId;
  await db.brandDraft.upsert({
    where: { userId },
    create: { userId, productId },
    update: { productId, ...(changed && { quantity: null }) },
  });
  return true;
}

export type PackagingResult =
  | { ok: true }
  | { ok: false; fieldErrors: Record<string, string> }
  | { ok: false; noProduct: true };

/** Step 2: the label text. The logo is uploaded separately (saveDraftLogo). */
export async function savePackaging(
  userId: string,
  values: Record<string, string>,
): Promise<PackagingResult> {
  const draft = await db.brandDraft.findUnique({
    where: { userId },
    select: { productId: true, logoKey: true },
  });
  if (!draft?.productId) return { ok: false, noProduct: true };
  const parsed = packagingSchema.safeParse(values);
  const fieldErrors = parsed.success ? {} : fieldErrorsOf(parsed.error);
  if (!draft.logoKey) fieldErrors.logo = copy.packaging.errors.logo;
  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }
  await db.brandDraft.update({
    where: { userId },
    data: { ...parsed.data, packagingDone: true },
  });
  return { ok: true };
}

export type LogoUploadError = "noDraft" | "empty" | "tooLarge" | "fileType";

/**
 * Step 2: stores the logo (PNG, JPEG or PDF, checked from its bytes) and
 * puts it on the draft, removing the one it replaces. The file is written
 * first; if the database step fails it's removed again.
 */
export async function saveDraftLogo(options: {
  userId: string;
  fileName: string;
  bytes: Uint8Array;
}): Promise<{ ok: true; logo: DraftLogo } | { ok: false; error: LogoUploadError }> {
  const checked = checkUpload(options.bytes, brandLogoUpload);
  if (!checked.ok) return checked;
  const draft = await db.brandDraft.findUnique({
    where: { userId: options.userId },
    select: { productId: true },
  });
  if (!draft?.productId) return { ok: false, error: "noDraft" };

  const fileKey = newFileKey("brand-logos", options.userId, checked.extension);
  await getStorage().put(fileKey, options.bytes);
  const logo: DraftLogo = {
    name: cleanFileName(options.fileName, checked.extension),
    contentType: checked.contentType,
    sizeBytes: options.bytes.byteLength,
  };
  let replaced: string | null = null;
  try {
    replaced = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ logoKey: string | null }[]>`
        SELECT logoKey FROM BrandDraft WHERE userId = ${options.userId} FOR UPDATE`;
      if (rows.length === 0) throw new DraftGone();
      await tx.brandDraft.update({
        where: { userId: options.userId },
        data: {
          logoKey: fileKey,
          logoName: logo.name,
          logoContentType: logo.contentType,
          logoSizeBytes: logo.sizeBytes,
        },
      });
      return rows[0]!.logoKey;
    });
  } catch (error) {
    await deleteFilesQuietly([fileKey]);
    if (error instanceof DraftGone) return { ok: false, error: "noDraft" };
    throw error;
  }
  if (replaced) await deleteFilesQuietly([replaced]);
  return { ok: true, logo };
}

class DraftGone extends Error {}

/** The draft logo's storage key and type, for serving it to its owner. */
export async function draftLogoFile(userId: string) {
  const draft = await db.brandDraft.findUnique({
    where: { userId },
    select: { logoKey: true, logoName: true, logoContentType: true },
  });
  if (!draft?.logoKey || !draft.logoName || !draft.logoContentType) return null;
  return { key: draft.logoKey, name: draft.logoName, contentType: draft.logoContentType };
}

export type QuantityResult =
  | { ok: true }
  | { ok: false; error: "product" | "packaging" }
  | { ok: false; error: "quantity"; minQty: number };

/** Step 3: a quantity in steps of the product's minimum. */
export async function saveBrandQuantity(userId: string, quantity: number | null): Promise<QuantityResult> {
  const draft = await readDraft(userId);
  if (!draft?.product) return { ok: false, error: "product" };
  if (furthestStep(draft) < 3) return { ok: false, error: "packaging" };
  if (quantity === null || !isValidBrandQuantity(quantity, draft.product.terms)) {
    return { ok: false, error: "quantity", minQty: draft.product.terms.minQty };
  }
  await db.brandDraft.update({ where: { userId }, data: { quantity } });
  return { ok: true };
}
