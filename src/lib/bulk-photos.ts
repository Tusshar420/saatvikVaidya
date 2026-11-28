import type { BrandVariant } from "@/lib/brand-theme";
import { MAX_PRODUCT_IMAGES } from "@/lib/catalogue";

// Bulk photo upload (/admin/catalogue/photos): the product search and the
// "room left" check run in the browser over the list the page loads. The
// server still checks each upload (src/server/admin/catalogue.ts).

export type PhotoProduct = {
  id: number;
  name: string;
  brand: string | null;
  packSize: string;
  active: boolean;
  /** Build Your Brand product: its photos can be marked with a label variant. */
  brandEligible: boolean;
  /** Photos it has now. */
  imageCount: number;
  variants: BrandVariant[];
};

const normalise = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Products whose name, brand or pack size hold every word of the query.
 * Names starting with the query come first; an empty query lists them all.
 */
export function searchPhotoProducts<T extends PhotoProduct>(
  query: string,
  products: T[],
  limit = 30,
): T[] {
  const q = normalise(query);
  if (!q) return products.slice(0, limit);
  const words = q.split(" ");
  const matches = products.filter((product) => {
    const haystack = normalise(`${product.name} ${product.brand ?? ""} ${product.packSize}`);
    return words.every((word) => haystack.includes(word));
  });
  const starts = (product: T) => (normalise(product.name).startsWith(q) ? 0 : 1);
  return matches
    .map((product, index) => ({ product, index }))
    .sort((a, b) => starts(a.product) - starts(b.product) || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.product);
}

/** Photos a product can still take. */
export function photoRoomLeft(product: Pick<PhotoProduct, "imageCount">) {
  return Math.max(0, MAX_PRODUCT_IMAGES - product.imageCount);
}

/**
 * Row ids that would go past a product's photo limit, in row order: the
 * first rows for a product fill its room, the rest are over.
 */
export function rowsOverLimit(
  rows: { id: string; productId: number | null }[],
  products: Pick<PhotoProduct, "id" | "imageCount">[],
): Set<string> {
  const room = new Map(products.map((product) => [product.id, photoRoomLeft(product)]));
  const over = new Set<string>();
  for (const row of rows) {
    if (row.productId === null) continue;
    const left = room.get(row.productId) ?? 0;
    if (left <= 0) over.add(row.id);
    else room.set(row.productId, left - 1);
  }
  return over;
}

/** The description a photo gets when the admin leaves it empty. */
export function defaultPhotoAlt(productName: string, variantName: string | null) {
  const text = variantName ? `${productName}: ${variantName}` : productName;
  return text.slice(0, 200);
}
