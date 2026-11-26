import "server-only";
import { z } from "zod";
import { admin as copy } from "@/content/admin";
import { brand as brandCopy } from "@/content/brand";
import { sortField, type Sort } from "@/lib/admin-sort";
import { MAX_BRAND_MIN_QTY, MAX_BRAND_TIERS, MAX_BRAND_UNITS, MAX_BRAND_UNIT_PRICE_PAISE } from "@/lib/brand";
import { randomBytes } from "node:crypto";
import {
  MAX_BRAND_VARIANTS,
  MAX_VARIANT_NAME,
  brandThemeKeys,
  toBrandVariants,
  variantKeyPattern,
  type BrandThemeKey,
  type BrandVariant,
} from "@/lib/brand-theme";
import type { Prisma } from "@/generated/prisma/client";
import {
  MAX_BULK_TIERS,
  MAX_PRODUCT_IMAGES,
  gstRates,
  productImageUpload,
  productSlugPattern,
  slugify,
} from "@/lib/catalogue";
import { paiseToRupeeInput, rupeesToPaise } from "@/lib/format";
import { db } from "@/server/db";
import { makeableByProduct, sellableByProduct } from "@/server/inventory/availability";
import { ensureProductItem } from "@/server/inventory/engine";
import { deleteFilesQuietly, getStorage, newFileKey } from "@/server/storage";
import { checkUpload } from "@/server/storage/files";
import { createdFields, diffFields, logAdminAction } from "./audit";
import {
  blankToNull,
  checkbox,
  fieldErrorsOf,
  optionalText,
  requiredText,
  sortOrder,
} from "./form";

// The catalogue in the admin panel (/admin/catalogue): products with their
// prices, bulk tiers, stock and images. Callers (server actions and the image
// upload route) check the admin session first and pass the admin's id as
// `actorId`. Products are hidden rather than deleted, so later orders can
// still point at them.

const errors = copy.catalogue.errors;
const brandErrors = brandCopy.catalogue.errors;
const imageErrors = copy.catalogue.images.errors;

export const ADMIN_PRODUCTS_PAGE_SIZE = 25;

/** ₹10,00,000: far above any single product, well inside an INT column. */
const MAX_PAISE = 100_000_000;

// ─── Form input ─────────────────────────────────────────────────────────────

/** A rupee amount from a form as paise, more than zero. */
function rupees(message: string) {
  return z.string({ error: message }).transform((text, ctx) => {
    const paise = rupeesToPaise(text);
    if (paise === null || paise <= 0 || paise > MAX_PAISE) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return paise;
  });
}

function wholeNumber(min: number, max: number, message: string) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.coerce.number({ error: message }).int(message).min(min, message).max(max, message),
  );
}

const tierRowSchema = z.object({
  minQuantity: z.string().trim(),
  price: z.string().trim(),
});

const productFormSchema = z
  .object({
    name: requiredText(160, errors.name),
    slug: z.preprocess(
      blankToNull,
      z
        .string({ error: errors.slug })
        .trim()
        .toLowerCase()
        .max(120, errors.slug)
        .regex(productSlugPattern, errors.slug)
        .nullable(),
    ),
    brandId: z.coerce.number({ error: errors.brand }).int(errors.brand).positive(errors.brand),
    formId: z.coerce.number({ error: errors.form }).int(errors.form).positive(errors.form),
    practiceAreaIds: z
      .array(z.coerce.number().int().positive(), { error: errors.practiceAreas })
      .max(50, errors.practiceAreas),
    packSize: requiredText(60, errors.packSize),
    description: requiredText(5000, errors.description),
    ingredients: optionalText(5000, errors.longText),
    dosage: optionalText(5000, errors.longText),
    mrp: rupees(errors.mrp),
    professionalPrice: rupees(errors.professionalPrice),
    gstRate: z.coerce
      .number({ error: errors.gstRate })
      .refine((rate) => (gstRates as readonly number[]).includes(rate), errors.gstRate),
    hsnCode: z
      .string({ error: errors.hsnCode })
      .trim()
      .regex(/^(?:\d{4}|\d{6}|\d{8})$/, errors.hsnCode),
    moq: wholeNumber(1, 10_000, errors.moq),
    tiers: z.array(tierRowSchema).max(MAX_BULK_TIERS),
    brandTiers: z.array(tierRowSchema).max(MAX_BRAND_TIERS),
    active: checkbox,
    featured: checkbox,
    isSample: checkbox,
    sortOrder: sortOrder("Check this field."),
    brandEligible: checkbox,
    brandMinQty: z.preprocess(blankToNull, z.string().trim().nullable()),
    brandUnitPrice: z.preprocess(blankToNull, z.string().trim().nullable()),
    /** The pack's label spec (blank: the general spec). */
    labelSpecId: z.preprocess(
      (value) => (blankToNull(value) === null ? null : Number(value)),
      z.number({ error: brandErrors.labelSpec }).int(brandErrors.labelSpec).positive(brandErrors.labelSpec).nullable(),
    ),
    brandUnitLabel: z.preprocess(
      blankToNull,
      z.string({ error: brandErrors.unitLabel }).trim().max(30, brandErrors.unitLabel).nullable(),
    ),
  })
  .transform((data, ctx) => {
    const slug = data.slug ?? slugify(data.name);
    if (!slug) ctx.addIssue({ code: "custom", path: ["slug"], message: errors.slug });

    if (data.professionalPrice > data.mrp) {
      ctx.addIssue({
        code: "custom",
        path: ["professionalPrice"],
        message: errors.professionalPrice,
      });
    }

    // Tiers: blank rows are skipped; each filled one needs a larger quantity
    // and a lower price than the one before, below the professional price.
    const bulkTiers: { minQuantity: number; pricePaise: number }[] = [];
    data.tiers.forEach((row, index) => {
      if (!row.minQuantity && !row.price) return;
      const path = (field: string) => ["tiers", index, field];
      if (!row.minQuantity || !row.price) {
        ctx.addIssue({
          code: "custom",
          path: path(row.minQuantity ? "price" : "minQuantity"),
          message: errors.tierIncomplete,
        });
        return;
      }
      const previous = bulkTiers.at(-1);
      const minQuantity = /^\d{1,7}$/.test(row.minQuantity) ? Number(row.minQuantity) : NaN;
      if (
        !(minQuantity >= 2 && minQuantity <= 1_000_000) ||
        (previous && minQuantity <= previous.minQuantity)
      ) {
        ctx.addIssue({ code: "custom", path: path("minQuantity"), message: errors.tierMin });
        return;
      }
      const pricePaise = rupeesToPaise(row.price);
      const ceiling = previous?.pricePaise ?? data.professionalPrice;
      if (pricePaise === null || pricePaise <= 0 || pricePaise >= ceiling) {
        ctx.addIssue({ code: "custom", path: path("price"), message: errors.tierPrice });
        return;
      }
      bulkTiers.push({ minQuantity, pricePaise });
    });

    // Build Your Brand terms (P2.1): optional, but each filled one must be
    // valid, and all three are needed to open the product for branding.
    const brandMinQty =
      data.brandMinQty === null
        ? null
        : /^\d{1,5}$/.test(data.brandMinQty) &&
            Number(data.brandMinQty) >= 1 &&
            Number(data.brandMinQty) <= MAX_BRAND_MIN_QTY
          ? Number(data.brandMinQty)
          : NaN;
    if (Number.isNaN(brandMinQty)) {
      ctx.addIssue({ code: "custom", path: ["brandMinQty"], message: brandErrors.minQty });
    }
    const brandPricePaise = data.brandUnitPrice === null ? null : rupeesToPaise(data.brandUnitPrice);
    const brandPriceValid =
      brandPricePaise !== null && brandPricePaise > 0 && brandPricePaise <= MAX_BRAND_UNIT_PRICE_PAISE;
    if (data.brandUnitPrice !== null && !brandPriceValid) {
      ctx.addIssue({ code: "custom", path: ["brandUnitPrice"], message: brandErrors.unitPrice });
    }
    if (
      data.brandEligible &&
      (data.brandMinQty === null || data.brandUnitPrice === null || data.brandUnitLabel === null)
    ) {
      ctx.addIssue({ code: "custom", path: ["brandEligible"], message: brandErrors.needed });
    }

    // Brand bulk tiers: like the store's, above the brand minimum and below
    // the branded price (and the tier before). They need those two first.
    const brandTiers: { minQuantity: number; pricePaise: number }[] = [];
    data.brandTiers.forEach((row, index) => {
      if (!row.minQuantity && !row.price) return;
      const path = (field: string) => ["brandTiers", index, field];
      if (!row.minQuantity || !row.price) {
        ctx.addIssue({
          code: "custom",
          path: path(row.minQuantity ? "price" : "minQuantity"),
          message: brandErrors.tierIncomplete,
        });
        return;
      }
      if (brandMinQty === null || Number.isNaN(brandMinQty) || !brandPriceValid || brandPricePaise === null) {
        ctx.addIssue({ code: "custom", path: path("minQuantity"), message: brandErrors.tierNeedsTerms });
        return;
      }
      const previous = brandTiers.at(-1);
      const minQuantity = /^\d{1,6}$/.test(row.minQuantity) ? Number(row.minQuantity) : NaN;
      if (
        !(minQuantity > brandMinQty && minQuantity <= MAX_BRAND_UNITS) ||
        (previous && minQuantity <= previous.minQuantity)
      ) {
        ctx.addIssue({ code: "custom", path: path("minQuantity"), message: brandErrors.tierMin });
        return;
      }
      const pricePaise = rupeesToPaise(row.price);
      const ceiling = previous?.pricePaise ?? brandPricePaise;
      if (pricePaise === null || pricePaise <= 0 || pricePaise >= ceiling) {
        ctx.addIssue({ code: "custom", path: path("price"), message: brandErrors.tierPrice });
        return;
      }
      brandTiers.push({ minQuantity, pricePaise });
    });

    return {
      name: data.name,
      slug,
      brandId: data.brandId,
      formId: data.formId,
      practiceAreaIds: [...new Set(data.practiceAreaIds)].sort((a, b) => a - b),
      packSize: data.packSize,
      description: data.description,
      ingredients: data.ingredients,
      dosage: data.dosage,
      mrpPaise: data.mrp,
      professionalPricePaise: data.professionalPrice,
      gstRate: data.gstRate,
      hsnCode: data.hsnCode,
      moq: data.moq,
      active: data.active,
      featured: data.featured,
      isSample: data.isSample,
      sortOrder: data.sortOrder,
      brandEligible: data.brandEligible,
      brandMinQty: Number.isNaN(brandMinQty) ? null : brandMinQty,
      brandUnitPricePaise: brandPriceValid ? brandPricePaise : null,
      brandUnitLabel: data.brandUnitLabel,
      labelSpecId: data.labelSpecId,
      bulkTiers,
      brandTiers,
    };
  });

export type ProductInput = z.output<typeof productFormSchema>;

/**
 * Turns the form's flat values into the product input. Practice areas come
 * from ticked `area-<id>` boxes and tiers from `tiers.<n>.minQuantity` /
 * `tiers.<n>.price` (brand tiers: `brandTiers.<n>....`), so a failed save
 * can show every value again.
 */
export function parseProductForm(
  values: Record<string, string>,
):
  | { success: true; data: ProductInput }
  | { success: false; fieldErrors: Record<string, string> } {
  const practiceAreaIds = Object.entries(values)
    .filter(([name, value]) => /^area-\d{1,10}$/.test(name) && value === "on")
    .map(([name]) => name.slice("area-".length));
  const tiers = Array.from({ length: MAX_BULK_TIERS }, (_, index) => ({
    minQuantity: values[`tiers.${index}.minQuantity`] ?? "",
    price: values[`tiers.${index}.price`] ?? "",
  }));
  const brandTiers = Array.from({ length: MAX_BRAND_TIERS }, (_, index) => ({
    minQuantity: values[`brandTiers.${index}.minQuantity`] ?? "",
    price: values[`brandTiers.${index}.price`] ?? "",
  }));
  const parsed = productFormSchema.safeParse({ ...values, practiceAreaIds, tiers, brandTiers });
  if (parsed.success) return { success: true, data: parsed.data };
  return { success: false, fieldErrors: fieldErrorsOf(parsed.error) };
}

// ─── Reading ────────────────────────────────────────────────────────────────

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

export const PRODUCT_SORTS = ["order", "name", "brand", "price", "added"] as const;
export const PRODUCT_SORT_DEFAULT: Sort<(typeof PRODUCT_SORTS)[number]> = { key: "order", dir: "asc" };

export const productFiltersSchema = z.object({
  q: z.preprocess(first, z.string().trim().max(100).optional()).catch(undefined),
  status: z.preprocess(first, z.enum(["active", "hidden"]).optional()).catch(undefined),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000)).catch(1),
  sort: sortField(PRODUCT_SORTS, PRODUCT_SORT_DEFAULT),
});

function productsOrderBy(sort: Sort<(typeof PRODUCT_SORTS)[number]>): Prisma.ProductOrderByWithRelationInput[] {
  const tail: Prisma.ProductOrderByWithRelationInput[] = [{ sortOrder: "asc" }, { id: "asc" }];
  switch (sort.key) {
    case "name":
      return [{ name: sort.dir }, ...tail];
    case "brand":
      return [{ brand: { name: sort.dir } }, { name: "asc" }, ...tail];
    case "price":
      return [{ mrpPaise: sort.dir }, ...tail];
    case "added":
      return [{ createdAt: sort.dir }, ...tail];
    default:
      return [{ sortOrder: sort.dir }, { id: sort.dir }];
  }
}

export type ProductFilters = z.infer<typeof productFiltersSchema>;

export async function listAdminProducts(filters: ProductFilters) {
  const where: Prisma.ProductWhereInput = {
    ...(filters.status && { active: filters.status === "active" }),
    ...(filters.q && {
      OR: [{ name: { contains: filters.q } }, { slug: { contains: filters.q } }],
    }),
  };
  const total = await db.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PRODUCTS_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const products = await db.product.findMany({
    where,
    orderBy: productsOrderBy(filters.sort),
    skip: (page - 1) * ADMIN_PRODUCTS_PAGE_SIZE,
    take: ADMIN_PRODUCTS_PAGE_SIZE,
    select: {
      id: true,
      slug: true,
      name: true,
      mrpPaise: true,
      professionalPricePaise: true,
      active: true,
      featured: true,
      isSample: true,
      brandEligible: true,
      brand: { select: { name: true } },
      images: {
        where: { variant: null },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        take: 1,
        select: { id: true },
      },
    },
  });
  // The right figure per product type: units on sale for the shop, units
  // that can be made from components for a Launch product.
  const ids = products.map((product) => product.id);
  const sellable = await sellableByProduct(ids);
  const makeable = await makeableByProduct(products.filter((product) => product.brandEligible).map((product) => product.id));
  return {
    products: products.map((product) => ({
      ...product,
      shopStock: sellable.get(product.id) ?? 0,
      launchMakeable: product.brandEligible ? (makeable.get(product.id) ?? null) : undefined,
    })),
    total,
    page,
    pageCount,
  };
}

export async function getAdminProduct(id: number) {
  return db.product.findUnique({
    where: { id },
    include: {
      practiceAreas: { select: { id: true } },
      bulkTiers: { orderBy: { minQuantity: "asc" } },
      brandTiers: { orderBy: { minQuantity: "asc" } },
      images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      variants: {
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
        select: { key: true, name: true, style: true },
      },
    },
  });
}

export type AdminProduct = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;

/** Brands, forms and practice areas for the product form's choices. */
export async function readProductFormOptions() {
  const [brands, categories, labelSpecs] = await Promise.all([
    db.brand.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true, kind: true, active: true },
    }),
    db.labelSpec.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true } }),
  ]);
  return {
    labelSpecs,
    brands,
    forms: categories.filter((c) => c.kind === "FORM"),
    areas: categories.filter((c) => c.kind === "PRACTICE_AREA"),
  };
}

export type ProductFormOptions = Awaited<ReturnType<typeof readProductFormOptions>>;

/** A saved product as the form's starting values (amounts in rupees). */
export function productFormValues(
  product: AdminProduct,
): Record<string, string | number | boolean | null> {
  const values: Record<string, string | number | boolean | null> = {
    name: product.name,
    slug: product.slug,
    brandId: product.brandId,
    formId: product.formId,
    packSize: product.packSize,
    description: product.description,
    ingredients: product.ingredients,
    dosage: product.dosage,
    mrp: paiseToRupeeInput(product.mrpPaise),
    professionalPrice: paiseToRupeeInput(product.professionalPricePaise),
    gstRate: product.gstRate,
    hsnCode: product.hsnCode,
    moq: product.moq,
    active: product.active,
    featured: product.featured,
    isSample: product.isSample,
    sortOrder: product.sortOrder,
    brandEligible: product.brandEligible,
    brandMinQty: product.brandMinQty,
    brandUnitPrice:
      product.brandUnitPricePaise === null ? null : paiseToRupeeInput(product.brandUnitPricePaise),
    brandUnitLabel: product.brandUnitLabel,
    labelSpecId: product.labelSpecId,
  };
  for (const area of product.practiceAreas) values[`area-${area.id}`] = true;
  product.bulkTiers.forEach((tier, index) => {
    values[`tiers.${index}.minQuantity`] = tier.minQuantity;
    values[`tiers.${index}.price`] = paiseToRupeeInput(tier.pricePaise);
  });
  product.brandTiers.forEach((tier, index) => {
    values[`brandTiers.${index}.minQuantity`] = tier.minQuantity;
    values[`brandTiers.${index}.price`] = paiseToRupeeInput(tier.pricePaise);
  });
  return values;
}

/** Starting values for a new product. */
export const newProductValues = {
  gstRate: 5,
  hsnCode: "3004",
  moq: 1,
  active: true,
  sortOrder: 0,
} satisfies Record<string, string | number | boolean>;

// ─── Create / update ────────────────────────────────────────────────────────

export type ProductResult =
  | { ok: true; id: number }
  | { ok: false; fieldErrors: Record<string, string> };

/** Unique clash (Prisma P2002), here only the slug. */
function isUniqueClash(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

/** Field errors for a brand, form or practice area that isn't valid. */
async function checkRelations(
  tx: Prisma.TransactionClient,
  input: ProductInput,
): Promise<Record<string, string> | null> {
  const [brand, form, areas] = await Promise.all([
    tx.brand.findUnique({ where: { id: input.brandId }, select: { id: true } }),
    tx.category.findFirst({
      where: { id: input.formId, kind: "FORM" },
      select: { id: true },
    }),
    tx.category.count({
      where: { id: { in: input.practiceAreaIds }, kind: "PRACTICE_AREA" },
    }),
  ]);
  const fieldErrors: Record<string, string> = {};
  if (input.labelSpecId !== null && !(await tx.labelSpec.findUnique({ where: { id: input.labelSpecId }, select: { id: true } }))) {
    fieldErrors.labelSpecId = brandErrors.labelSpec;
  }
  if (!brand) fieldErrors.brandId = errors.brand;
  if (!form) fieldErrors.formId = errors.form;
  if (areas !== input.practiceAreaIds.length) {
    fieldErrors.practiceAreaIds = errors.practiceAreas;
  }
  return Object.keys(fieldErrors).length ? fieldErrors : null;
}

/** The audit-log view of a product: its fields, with areas and tiers as text. */
function auditValues(input: {
  practiceAreaIds: number[];
  bulkTiers: { minQuantity: number; pricePaise: number }[];
  brandTiers: { minQuantity: number; pricePaise: number }[];
} & Record<string, unknown>) {
  const { practiceAreaIds, bulkTiers, brandTiers, ...fields } = input;
  const tierText = (tiers: { minQuantity: number; pricePaise: number }[]) =>
    tiers.map((t) => `${t.minQuantity}:${t.pricePaise}`).join(",");
  return {
    ...fields,
    practiceAreaIds: practiceAreaIds.join(","),
    bulkTiers: tierText(bulkTiers),
    brandTiers: tierText(brandTiers),
  };
}

const slugTaken = { ok: false as const, fieldErrors: { slug: errors.slugTaken } };

export async function createProduct(
  input: ProductInput,
  actorId: string,
): Promise<ProductResult> {
  const { practiceAreaIds, bulkTiers, brandTiers, ...fields } = input;
  try {
    return await db.$transaction(async (tx) => {
      const invalid = await checkRelations(tx, input);
      if (invalid) return { ok: false as const, fieldErrors: invalid };
      const product = await tx.product.create({
        data: {
          ...fields,
          practiceAreas: { connect: practiceAreaIds.map((id) => ({ id })) },
          bulkTiers: { create: bulkTiers },
          brandTiers: { create: brandTiers },
        },
        select: { id: true, name: true },
      });
      // Every product is a finished-goods stock item (stocked in Inventory).
      await ensureProductItem(tx, product);
      await logAdminAction(tx, {
        actorId,
        action: "product.create",
        resource: "Product",
        resourceId: product.id,
        changes: createdFields(auditValues(input)),
      });
      return { ok: true as const, id: product.id };
    });
  } catch (error) {
    if (isUniqueClash(error)) return slugTaken;
    throw error;
  }
}

/** Null when the product no longer exists. */
export async function updateProduct(
  id: number,
  input: ProductInput,
  actorId: string,
): Promise<ProductResult | null> {
  const { practiceAreaIds, bulkTiers, brandTiers, ...fields } = input;
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id },
        include: {
          practiceAreas: { select: { id: true }, orderBy: { id: "asc" } },
          bulkTiers: { orderBy: { minQuantity: "asc" } },
          brandTiers: { orderBy: { minQuantity: "asc" } },
        },
      });
      if (!existing) return null;
      const invalid = await checkRelations(tx, input);
      if (invalid) return { ok: false as const, fieldErrors: invalid };

      const changes = diffFields(
        auditValues({
          ...existing,
          practiceAreaIds: existing.practiceAreas.map((area) => area.id),
          bulkTiers: existing.bulkTiers,
          brandTiers: existing.brandTiers,
        }),
        auditValues(input),
      );
      if (Object.keys(changes).length === 0) return { ok: true as const, id };

      await tx.product.update({
        where: { id },
        data: {
          ...fields,
          practiceAreas: { set: practiceAreaIds.map((areaId) => ({ id: areaId })) },
          bulkTiers: { deleteMany: {}, create: bulkTiers },
          brandTiers: { deleteMany: {}, create: brandTiers },
        },
      });
      await logAdminAction(tx, {
        actorId,
        action: "product.update",
        resource: "Product",
        resourceId: id,
        changes,
      });
      return { ok: true as const, id };
    });
  } catch (error) {
    if (isUniqueClash(error)) return slugTaken;
    throw error;
  }
}

// ─── Images ─────────────────────────────────────────────────────────────────

export const imageAltSchema = requiredText(200, imageErrors.alt);

/**
 * Which picture a photo is: "" (or missing) for a general photo, or a
 * variant key for that Build Your Brand variant's photo. Whether the product
 * has that variant is checked when saving.
 */
export const imageVariantSchema = z
  .union([z.literal(""), z.string().regex(variantKeyPattern)])
  .nullish()
  .transform((value): string | null => value || null);

export type ImageUploadError =
  | "notFound"
  | "tooMany"
  | "empty"
  | "tooLarge"
  | "fileType"
  /** The product has no variant with that key. */
  | "variant";

/** A product's label variants as buyers see them (the four defaults until set). */
async function productVariants(
  client: Prisma.TransactionClient,
  productId: number,
): Promise<BrandVariant[]> {
  const rows = await client.productVariant.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    select: { key: true, name: true, style: true },
  });
  return toBrandVariants(rows, brandCopy.customise.themes);
}

async function hasVariant(client: Prisma.TransactionClient, productId: number, key: string | null) {
  if (key === null) return true;
  return (await productVariants(client, productId)).some((variant) => variant.key === key);
}

/** Locks the product row so two uploads can't both take the last slot. */
async function lockProduct(tx: Prisma.TransactionClient, productId: number) {
  const rows = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM Product WHERE id = ${productId} FOR UPDATE`;
  return rows.length > 0;
}

/**
 * Checks and stores a photo, then adds it after the product's other images.
 * The file is written first; if the database step fails it's removed again.
 */
export async function addProductImage(options: {
  productId: number;
  bytes: Uint8Array;
  alt: string;
  /** A variant key for a Build Your Brand variant photo; null or missing: general. */
  variant?: string | null;
  actorId: string;
}): Promise<{ ok: true; id: number } | { ok: false; error: ImageUploadError }> {
  const checked = checkUpload(options.bytes, productImageUpload);
  if (!checked.ok) return checked;

  const exists = await db.product.count({ where: { id: options.productId } });
  if (!exists) return { ok: false, error: "notFound" };

  const fileKey = newFileKey("products", String(options.productId), checked.extension);
  await getStorage().put(fileKey, options.bytes);

  let result: { ok: true; id: number } | { ok: false; error: ImageUploadError };
  try {
    result = await db.$transaction(async (tx) => {
      if (!(await lockProduct(tx, options.productId))) {
        return { ok: false as const, error: "notFound" as const };
      }
      const images = await tx.productImage.findMany({
        where: { productId: options.productId },
        select: { sortOrder: true },
      });
      if (images.length >= MAX_PRODUCT_IMAGES) {
        return { ok: false as const, error: "tooMany" as const };
      }
      if (!(await hasVariant(tx, options.productId, options.variant ?? null))) {
        return { ok: false as const, error: "variant" as const };
      }
      const last = Math.max(0, ...images.map((image) => image.sortOrder));
      const image = await tx.productImage.create({
        data: {
          productId: options.productId,
          fileKey,
          contentType: checked.contentType,
          sizeBytes: options.bytes.byteLength,
          alt: options.alt,
          variant: options.variant ?? null,
          sortOrder: last + 10,
        },
        select: { id: true },
      });
      await logAdminAction(tx, {
        actorId: options.actorId,
        action: "product.image.add",
        resource: "Product",
        resourceId: options.productId,
        changes: createdFields({
          imageId: image.id,
          alt: options.alt,
          variant: options.variant ?? null,
        }),
      });
      return { ok: true as const, id: image.id };
    });
  } catch (error) {
    await deleteFilesQuietly([fileKey]);
    throw error;
  }
  if (!result.ok) await deleteFilesQuietly([fileKey]);
  return result;
}

/** False when the image no longer exists. */
export async function deleteProductImage(
  imageId: number,
  actorId: string,
): Promise<{ productId: number } | null> {
  const deleted = await db.$transaction(async (tx) => {
    const image = await tx.productImage.findUnique({ where: { id: imageId } });
    if (!image) return null;
    await tx.productImage.delete({ where: { id: imageId } });
    await logAdminAction(tx, {
      actorId,
      action: "product.image.delete",
      resource: "Product",
      resourceId: image.productId,
      changes: createdFields({ imageId, alt: image.alt }),
    });
    return image;
  });
  if (!deleted) return null;
  await deleteFilesQuietly([deleted.fileKey]);
  return { productId: deleted.productId };
}

/**
 * Swaps an image with its neighbour ("up" = earlier). Renumbers the
 * product's images 10, 20, 30... so the order stays clean.
 */
export async function moveProductImage(
  imageId: number,
  direction: "up" | "down",
  actorId: string,
): Promise<{ productId: number } | null> {
  return db.$transaction(async (tx) => {
    const image = await tx.productImage.findUnique({
      where: { id: imageId },
      select: { productId: true },
    });
    if (!image) return null;
    const images = await tx.productImage.findMany({
      where: { productId: image.productId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const from = images.findIndex((row) => row.id === imageId);
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= images.length) return { productId: image.productId };
    [images[from], images[to]] = [images[to], images[from]];
    for (const [index, row] of images.entries()) {
      await tx.productImage.update({
        where: { id: row.id },
        data: { sortOrder: (index + 1) * 10 },
      });
    }
    await logAdminAction(tx, {
      actorId,
      action: "product.image.update",
      resource: "Product",
      resourceId: image.productId,
      changes: { imageId: { from: imageId, to: imageId }, position: { from: from + 1, to: to + 1 } },
    });
    return { productId: image.productId };
  });
}

/** Changes a photo's description and which variant (if any) it shows. */
export async function updateProductImageDetails(
  imageId: number,
  details: { alt: string; variant: string | null },
  actorId: string,
): Promise<{ productId: number } | { error: "variant" } | null> {
  return db.$transaction(async (tx) => {
    const image = await tx.productImage.findUnique({ where: { id: imageId } });
    if (!image) return null;
    if (details.variant !== image.variant && !(await hasVariant(tx, image.productId, details.variant))) {
      return { error: "variant" as const };
    }
    const changes = diffFields(
      { alt: image.alt, variant: image.variant },
      { alt: details.alt, variant: details.variant },
    );
    if (Object.keys(changes).length === 0) return { productId: image.productId };
    await tx.productImage.update({
      where: { id: imageId },
      data: { alt: details.alt, variant: details.variant },
    });
    await logAdminAction(tx, {
      actorId,
      action: "product.image.update",
      resource: "Product",
      resourceId: image.productId,
      changes: { imageId: { from: imageId, to: imageId }, ...changes },
    });
    return { productId: image.productId };
  });
}

// ─── Build Your Brand variants ──────────────────────────────────────────────

const variantErrors = copy.catalogue.variants.errors;

/** One variant as typed in the Variants form; `key` is "" for a new one. */
export type VariantInput = { key: string; name: string; style: BrandThemeKey };

const variantRowSchema = z.object({
  key: z.union([z.literal(""), z.string().regex(variantKeyPattern)]),
  name: z
    .string()
    .trim()
    .min(1, variantErrors.name(MAX_VARIANT_NAME))
    .max(MAX_VARIANT_NAME, variantErrors.name(MAX_VARIANT_NAME)),
  style: z.enum(brandThemeKeys, { error: variantErrors.style }),
});

/**
 * Reads the Variants form: one "variantKey", "variantName" and
 * "variantStyle" per row, in order. Field errors are keyed
 * "variantName-<index>" / "variantStyle-<index>"; "variants" is for the list.
 */
export function parseVariantsForm(
  getAll: (field: string) => unknown[],
): { ok: true; variants: VariantInput[] } | { ok: false; fieldErrors: Record<string, string> } {
  const keys = getAll("variantKey");
  const names = getAll("variantName");
  const styles = getAll("variantStyle");
  if (keys.length !== names.length || keys.length !== styles.length) {
    return { ok: false, fieldErrors: { variants: variantErrors.count(MAX_BRAND_VARIANTS) } };
  }
  if (keys.length < 1 || keys.length > MAX_BRAND_VARIANTS) {
    return { ok: false, fieldErrors: { variants: variantErrors.count(MAX_BRAND_VARIANTS) } };
  }
  const variants: VariantInput[] = [];
  const fieldErrors: Record<string, string> = {};
  keys.forEach((key, index) => {
    const parsed = variantRowSchema.safeParse({ key, name: names[index], style: styles[index] });
    if (parsed.success) {
      variants.push(parsed.data);
      return;
    }
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] === "style" ? "variantStyle" : "variantName";
      fieldErrors[`${field}-${index}`] ??= issue.message;
    }
    // A changed hidden key: the whole list is refused.
    if (parsed.error.issues.some((issue) => issue.path[0] === "key")) {
      fieldErrors.variants = variantErrors.count(MAX_BRAND_VARIANTS);
    }
  });
  const savedKeys = variants.map((variant) => variant.key).filter(Boolean);
  if (new Set(savedKeys).size !== savedKeys.length) {
    fieldErrors.variants = variantErrors.count(MAX_BRAND_VARIANTS);
  }
  return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: true, variants };
}

const describeVariants = (variants: { name: string; style: string }[]) =>
  variants.map((variant) => `${variant.name} (${variant.style})`).join(", ");

/**
 * Sets a product's label variants: renames, colours, order, new ones (a
 * fresh key) and removed ones. Photos of a removed variant become general
 * photos; cart lines that chose it fall back to the first variant when read.
 * Null when the product doesn't exist; "unknownKey" when a kept key isn't
 * one of the product's variants (a stale form).
 */
export async function saveProductVariants(
  productId: number,
  input: VariantInput[],
  actorId: string,
): Promise<{ productId: number } | { error: "unknownKey" } | null> {
  return db.$transaction(async (tx) => {
    // One save per product at a time; the row lock is on Product only.
    if (!(await lockProduct(tx, productId))) return null;
    const stored = await tx.productVariant.findMany({
      where: { productId },
      select: { key: true, name: true, style: true },
    });
    const before = await productVariants(tx, productId);
    const beforeKeys = new Set(before.map((variant) => variant.key));
    if (input.some((variant) => variant.key && !beforeKeys.has(variant.key))) {
      return { error: "unknownKey" as const };
    }
    const after = input.map((variant) => ({
      ...variant,
      key: variant.key || `v${randomBytes(4).toString("hex")}`,
    }));
    const changes = diffFields(
      { variants: describeVariants(before) },
      { variants: describeVariants(after) },
    );
    const sameOrder = before.map((v) => v.key).join() === after.map((v) => v.key).join();
    if (Object.keys(changes).length === 0 && sameOrder && stored.length > 0) {
      return { productId };
    }

    // Row by row, by exact key: a range delete takes gap locks in MySQL, and
    // two products saved at once could then deadlock.
    const afterKeys = new Set(after.map((variant) => variant.key));
    for (const row of stored) {
      if (!afterKeys.has(row.key)) {
        await tx.productVariant.delete({ where: { productId_key: { productId, key: row.key } } });
      }
    }
    const storedKeys = new Set(stored.map((row) => row.key));
    for (const [index, variant] of after.entries()) {
      const data = { name: variant.name, style: variant.style, sortOrder: (index + 1) * 10 };
      if (storedKeys.has(variant.key)) {
        await tx.productVariant.update({
          where: { productId_key: { productId, key: variant.key } },
          data,
        });
      } else {
        await tx.productVariant.create({ data: { productId, key: variant.key, ...data } });
      }
    }
    const removed = before.filter((variant) => !afterKeys.has(variant.key)).map((v) => v.key);
    if (removed.length > 0) {
      await tx.productImage.updateMany({
        where: { productId, variant: { in: removed } },
        data: { variant: null },
      });
    }
    await logAdminAction(tx, {
      actorId,
      action: "product.update",
      resource: "Product",
      resourceId: productId,
      changes:
        Object.keys(changes).length > 0
          ? changes
          : { variants: { from: describeVariants(before), to: describeVariants(after) } },
    });
    return { productId };
  });
}
