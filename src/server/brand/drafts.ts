import "server-only";
import { z } from "zod";
import { brand as copy } from "@/content/brand";
import type { Prisma } from "@/generated/prisma/client";
import {
  brandSorts,
  type BrandSort,
  brandTermsOf,
  type BrandTerms,
} from "@/lib/brand";
import { packMrpProblem } from "@/lib/brand-theme";
import type { LabelProblem, LabelValues } from "@/lib/label";
import { CATALOGUE_PAGE_SIZE, productImageSrc } from "@/lib/catalogue";
import { searchWhere } from "@/server/catalogue/products";
import { db } from "@/server/db";
import { makeableByProduct } from "@/server/inventory/availability";
import { saveLabelDetails } from "./labels";
import { orderNotesSchema } from "./packaging";
import { chosenProfile, listProfiles } from "./profiles";

// Build Your Brand drafts (docs/CHUNKS.md, P2.1): the packaging of the
// order a signed-in user is putting together on /launch, one per user: which
// saved brand profile it uses (./profiles.ts), the notes for the team and
// whether the label details were confirmed (./labels.ts). The products and quantities are in the Launch cart
// (./cart.ts). Callers check the session and pass the signed-in user's id;
// nothing here trusts the browser, and everything is checked again when the
// order is placed (./orders.ts).

// ─── Products ───────────────────────────────────────────────────────────────

/** Products that can be ordered in the buyer's packaging right now. */
export const brandProductWhere = {
  active: true,
  brandEligible: true,
  brandMinQty: { gte: 1 },
  brandUnitPricePaise: { gte: 1 },
  brandUnitLabel: { not: null },
} satisfies Prisma.ProductWhereInput;

export const brandProductSelect = {
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
  brandTiers: { select: { minQuantity: true, pricePaise: true } },
  form: { select: { key: true, name: true, glyph: true } },
  brand: { select: { name: true } },
  images: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    take: 1,
    select: { id: true, alt: true },
  },
} satisfies Prisma.ProductSelect;

export type BrandProductRow = Prisma.ProductGetPayload<{ select: typeof brandProductSelect }>;

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
  /**
   * Units that can be made from the components in stock (a multiple of the
   * minimum), or null when nothing limits it (no recipe yet).
   */
  makeable: number | null;
};

export function toBrandProduct(row: BrandProductRow, makeable: number | null = null): BrandProduct | null {
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
    makeable,
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
  const makeable = await makeableByProduct(rows.map((row) => row.id));
  return {
    filters: { ...used, page },
    products: rows.flatMap((row) => toBrandProduct(row, makeable.get(row.id) ?? null) ?? []),
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
  if (!row) return null;
  return toBrandProduct(row, (await makeableByProduct([productId], client)).get(productId) ?? null);
}

/** One eligible product by its slug, or null (the product's page at /launch/[slug]). */
export async function findBrandProductBySlug(slug: string): Promise<BrandProduct | null> {
  const row = await db.product.findUnique({ where: { slug }, select: brandProductSelect });
  if (!row) return null;
  return toBrandProduct(row, (await makeableByProduct([row.id])).get(row.id) ?? null);
}

// ─── Drafts ─────────────────────────────────────────────────────────────────

export type BrandDraftView = {
  /** The profile picked for this order (null: the default profile is used). */
  profileId: number | null;
  notes: string | null;
  packagingDone: boolean;
  updatedAt: Date;
};

export async function readDraft(userId: string): Promise<BrandDraftView | null> {
  const draft = await db.brandDraft.findUnique({ where: { userId } });
  if (!draft) return null;
  return {
    profileId: draft.profileId,
    notes: draft.notes,
    packagingDone: draft.packagingDone,
    updatedAt: draft.updatedAt,
  };
}

/** True when the user's Launch cart has at least one product. */
async function hasCart(userId: string): Promise<boolean> {
  return (await db.brandCartItem.count({ where: { userId } })) > 0;
}

export type PackagingResult =
  | { ok: true }
  | { ok: false; noProduct: true }
  | { ok: false; noProfile: true }
  | { ok: false; noLogo: true }
  | { ok: false; notesError: string }
  /** The MRP per pack is missing or unusable for these products (see packMrpProblem). */
  | { ok: false; mrpProblems: Map<number, "missing" | "low" | "high"> }
  /** Some product's label text is over its limit (or has no brand name). */
  | { ok: false; labelProblems: Map<number, LabelProblem[]> };

/**
 * Step 2 (brand details): confirms the packaging of the order: the brand
 * profile (it needs a logo), the notes for the team and every product's label
 * details, which `labels` are the typed values of (only the differences from
 * the profile are kept; see ./labels.ts). The step is only done when every
 * label fits. `mrps` (whole rupees per product, from the brand details form)
 * must cover every product in the cart when given; they are saved on the
 * cart lines.
 */
export async function savePackaging(
  userId: string,
  input: { notes?: string; labels?: Map<number, LabelValues>; mrps?: Map<number, number> },
): Promise<PackagingResult> {
  if (!(await hasCart(userId))) return { ok: false, noProduct: true };
  const notes = orderNotesSchema.safeParse({ notes: input.notes ?? "" });
  if (!notes.success) return { ok: false, notesError: copy.packaging.errors.notes };
  const draft = await db.brandDraft.findUnique({ where: { userId }, select: { profileId: true } });
  const profiles = await listProfiles(userId);
  const profile = chosenProfile(profiles, draft);
  if (!profile) return { ok: false, noProfile: true };
  if (!profile.logo) return { ok: false, noLogo: true };

  const { mrps } = input;
  if (mrps) {
    const cart = await db.brandCartItem.findMany({
      where: { userId },
      select: { productId: true, product: { select: brandProductSelect } },
    });
    const mrpProblems = new Map<number, "missing" | "low" | "high">();
    for (const row of cart) {
      const product = toBrandProduct(row.product);
      // A product no longer open for branding is reported by the cart itself.
      if (!product) continue;
      const problem = packMrpProblem(mrps.get(row.productId) ?? 0, product.terms.unitPricePaise);
      if (problem) mrpProblems.set(row.productId, problem);
    }
    if (mrpProblems.size > 0) return { ok: false, mrpProblems };
    await db.$transaction(
      cart.map((row) =>
        db.brandCartItem.updateMany({
          where: { userId, productId: row.productId },
          data: { packMrpPaise: (mrps.get(row.productId) ?? 0) * 100 },
        }),
      ),
    );
  }

  const { problems } = await saveLabelDetails(userId, profile, input.labels ?? new Map());
  // The brand and the notes are kept even when a label still needs work.
  await db.brandDraft.upsert({
    where: { userId },
    create: { userId, profileId: profile.id, notes: notes.data.notes, packagingDone: problems.size === 0 },
    update: { profileId: profile.id, notes: notes.data.notes, packagingDone: problems.size === 0 },
  });
  if (problems.size > 0) return { ok: false, labelProblems: problems };
  return { ok: true };
}
