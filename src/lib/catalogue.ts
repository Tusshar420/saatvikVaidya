// Catalogue rules shared by the server, the admin forms and the pages:
// sort options, page size, GST rates, slugs and product image uploads.
// Labels live in src/content/catalogue.ts and src/content/admin.ts.

export const catalogueSorts = [
  "featured",
  "price-asc",
  "price-desc",
  "name",
  "newest",
] as const;

export type CatalogueSort = (typeof catalogueSorts)[number];

export const CATALOGUE_PAGE_SIZE = 12;

/** GST percentages an admin can choose for a product. */
export const gstRates = [0, 5, 12, 18, 28, 40] as const;

/** Product URL segment: lowercase words joined by dashes. */
export const productSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Punarnava Mandoor (60 tabs)" -> "punarnava-mandoor-60-tabs". */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

/** The most bulk tiers one product may have. */
export const MAX_BULK_TIERS = 5;

/** The most images one product may have. */
export const MAX_PRODUCT_IMAGES = 8;

/** Accepted product photos; the type is checked from the file's first bytes. */
export const productImageUpload = {
  maxBytes: 5 * 1024 * 1024,
  /** Content type → file extension used in storage. */
  types: {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  },
  /** For the file input's `accept` attribute (a hint only). */
  accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp",
} as const;

/** Where a product image is served from. */
export const productImageSrc = (id: number) => `/api/product-images/${id}`;

/** The catalogue listing with these filters, e.g. { brand: "flowgra" }. */
export function catalogueHref(
  filters: Partial<Record<"q" | "form" | "area" | "brand" | "sort", string>> = {},
): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) {
    if (value) query.set(name, value);
  }
  const text = query.toString();
  return text ? `/products?${text}` : "/products";
}

export const productHref = (slug: string) => `/products/${slug}`;
