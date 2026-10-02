// Launch Your Brand rules (docs/CHUNKS.md, P2.1), shared by the /launch
// pages (to step the quantity and show prices) and the server (which checks
// everything again). No "server-only" import: client components use it too.

/** The /launch steps, in order. */
export const launchSteps = ["product", "packaging", "quantity", "review"] as const;
export type LaunchStep = (typeof launchSteps)[number];

/** Step 1-4 from a `?step=` value; anything else is step 1. */
export function launchStepNumber(value: unknown): number {
  const text = Array.isArray(value) ? value[0] : value;
  const n = typeof text === "string" && /^[1-4]$/.test(text) ? Number(text) : 1;
  return n;
}

/** The most units of one branded order (far above any real order). */
export const MAX_BRAND_UNITS = 100_000;

/** The largest brand minimum an admin may set. */
export const MAX_BRAND_MIN_QTY = 10_000;

/** ₹1,00,000 per unit: far above any real price. */
export const MAX_BRAND_UNIT_PRICE_PAISE = 10_000_000;

/** ₹1 crore: the largest branded order online (larger ones are arranged by phone). */
export const MAX_BRAND_ORDER_PAISE = 1_000_000_000;

/** The minimum and price that decide which quantities are allowed. */
export type QuantityTerms = { minQty: number; unitPricePaise: number };

/**
 * The biggest allowed quantity: the largest multiple of the minimum within
 * MAX_BRAND_UNITS whose total stays within MAX_BRAND_ORDER_PAISE. Zero when
 * not even the minimum fits.
 */
export function maxBrandQuantity({ minQty, unitPricePaise }: QuantityTerms): number {
  if (!Number.isInteger(minQty) || minQty < 1) return 0;
  if (!Number.isInteger(unitPricePaise) || unitPricePaise < 1) return 0;
  const units = Math.min(MAX_BRAND_UNITS, Math.floor(MAX_BRAND_ORDER_PAISE / unitPricePaise));
  return Math.floor(units / minQty) * minQty;
}

/**
 * A branded quantity must be a positive whole multiple of the product's
 * minimum (minimum 4: 4, 8, 12...), and no more than maxBrandQuantity().
 */
export function isValidBrandQuantity(quantity: number, terms: QuantityTerms): boolean {
  return (
    Number.isInteger(quantity) &&
    quantity >= terms.minQty &&
    quantity % terms.minQty === 0 &&
    quantity <= maxBrandQuantity(terms)
  );
}

/** + adds the minimum, − takes it off; never below the minimum or above the cap. */
export function stepBrandQuantity(
  quantity: number,
  terms: QuantityTerms,
  direction: "up" | "down",
): number {
  const start = snapBrandQuantity(quantity, terms);
  const next = direction === "up" ? start + terms.minQty : start - terms.minQty;
  return Math.min(Math.max(next, terms.minQty), Math.max(terms.minQty, maxBrandQuantity(terms)));
}

/**
 * A typed quantity, moved to the nearest allowed one: rounded up to a
 * multiple of the minimum, and kept between the minimum and the cap.
 */
export function snapBrandQuantity(quantity: number, terms: QuantityTerms): number {
  const { minQty } = terms;
  if (!Number.isFinite(quantity) || minQty < 1) return Math.max(minQty, 1);
  const rounded = Math.ceil(Math.max(quantity, minQty) / minQty) * minQty;
  return Math.min(rounded, Math.max(minQty, maxBrandQuantity(terms)));
}

/** What a product needs to be orderable on Launch Your Brand. */
export type BrandTerms = {
  minQty: number;
  unitPricePaise: number;
  unitLabel: string;
};

/** The product's brand terms, or null if it isn't set up for Launch Your Brand. */
export function brandTermsOf(product: {
  brandEligible: boolean;
  brandMinQty: number | null;
  brandUnitPricePaise: number | null;
  brandUnitLabel: string | null;
}): BrandTerms | null {
  const { brandMinQty, brandUnitPricePaise, brandUnitLabel } = product;
  if (!product.brandEligible || !brandMinQty || !brandUnitPricePaise || !brandUnitLabel) {
    return null;
  }
  if (brandMinQty < 1 || brandUnitPricePaise < 1) return null;
  return { minQty: brandMinQty, unitPricePaise: brandUnitPricePaise, unitLabel: brandUnitLabel };
}

/** Logo upload rules: PNG, JPEG or PDF (type checked from the bytes), up to 5 MB. No SVG. */
export const brandLogoUpload = {
  maxBytes: 5 * 1024 * 1024,
  /** Content type → file extension used in storage. */
  types: {
    "image/png": "png",
    "image/jpeg": "jpg",
    "application/pdf": "pdf",
  },
  /** For the file input's `accept` attribute (a hint only). */
  accept: ".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf",
} as const;

export type BrandLogoType = keyof typeof brandLogoUpload.types;

export function isImageLogo(contentType: string | null | undefined): boolean {
  return contentType === "image/png" || contentType === "image/jpeg";
}

/** Longest value of each packaging field (matches the database columns). */
export const packagingLimits = {
  brandName: 80,
  tagline: 120,
  marketedByName: 120,
  marketedByAddress: 300,
  contactPhone: 20,
  notes: 1000,
} as const;

/** Digits with optional +, spaces, dashes and brackets: 8 to 15 digits in all. */
export function isContactNumber(value: string): boolean {
  if (!/^\+?[\d\s()-]{8,20}$/.test(value)) return false;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 8 && digits <= 15;
}

export const brandSorts = ["featured", "price-asc", "price-desc", "name", "newest"] as const;
export type BrandSort = (typeof brandSorts)[number];

/** Step 1 with these filters, e.g. { form: "syrup", minPrice: "100" }; defaults left out. */
export function launchHref(
  filters: Partial<Record<"q" | "form" | "area" | "maker" | "minPrice" | "maxPrice" | "sort" | "page", string | number>> = {},
): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue;
    if (name === "sort" && value === "featured") continue;
    if (name === "page" && Number(value) <= 1) continue;
    query.set(name, String(value));
  }
  const text = query.toString();
  return text ? `/launch?${text}` : "/launch";
}
