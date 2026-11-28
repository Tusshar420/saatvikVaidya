// Label colour themes for Build Your Brand: the "Select variant" choice on a
// product's page. Shared by the pages (swatches and previews) and the server
// (which only accepts a key from this list). No "server-only" import.

export const brandThemes = [
  { key: "classic-green", pack: "bg-pack-green", dark: false },
  { key: "saffron-glow", pack: "bg-pack-saffron", dark: false },
  { key: "royal-maroon", pack: "bg-pack-maroon", dark: false },
  { key: "minimal-white", pack: "bg-pack-white", dark: true },
] as const;

export type BrandThemeKey = (typeof brandThemes)[number]["key"];

export const brandThemeKeys = brandThemes.map((theme) => theme.key) as [
  BrandThemeKey,
  ...BrandThemeKey[],
];

export const DEFAULT_BRAND_THEME: BrandThemeKey = "classic-green";

/** The longest name an admin may give a product's label variant. */
export const MAX_VARIANT_NAME = 40;

/** How many label variants a product may have (at least one). */
export const MAX_BRAND_VARIANTS = 8;

/**
 * A variant's key: the four default variants use their theme key; variants
 * an admin adds get "v" and random letters. Stored on cart lines, photos and
 * orders, so it never changes once made.
 */
export const variantKeyPattern = /^[a-z0-9-]{1,24}$/;

/**
 * One label variant of a Build Your Brand product: what the buyer picks on
 * the product page. `style` is the drawn pack's colours, used when the
 * variant has no photo.
 */
export type BrandVariant = { key: string; name: string; style: BrandThemeKey };

/** The four variants every product has until an admin sets its own list. */
export function defaultBrandVariants(defaults: Record<string, string>): BrandVariant[] {
  return brandThemes.map((theme) => ({
    key: theme.key,
    name: defaults[theme.key] ?? theme.key,
    style: theme.key,
  }));
}

/**
 * A product's variants from its stored rows (in their order), or the four
 * defaults when it has none. `defaults` are the default names
 * (src/content/brand.ts, customise.themes).
 */
export function toBrandVariants(
  rows: { key: string; name: string; style: string }[],
  defaults: Record<string, string>,
): BrandVariant[] {
  if (rows.length === 0) return defaultBrandVariants(defaults);
  return rows.map((row) => ({ key: row.key, name: row.name, style: brandThemeOf(row.style).key }));
}

/** The variant for a stored key, or the product's first when it's gone. */
export function pickVariant(
  key: string | null | undefined,
  variants: BrandVariant[],
): BrandVariant | undefined {
  return variants.find((variant) => variant.key === key) ?? variants[0];
}

/**
 * The name to show for a variant key: the product's variant name when it
 * still has it, else the default name, else the key as stored (an old order).
 */
export function variantName(
  key: string,
  variants: BrandVariant[] | undefined,
  defaults: Record<string, string>,
): string {
  return variants?.find((variant) => variant.key === key)?.name || defaults[key] || key;
}

/** The theme for a stored key; an unknown or missing key is the first theme. */
export function brandThemeOf(key: string | null | undefined) {
  return brandThemes.find((theme) => theme.key === key) ?? brandThemes[0];
}

/** The most an MRP per pack may be: ₹1,00,000, far above any real price. */
export const MAX_PACK_MRP_RUPEES = 100_000;

/**
 * Why an MRP typed by the buyer can't be used, or null when it can. The MRP
 * is the price printed on the pack, in whole rupees: a positive number, not
 * below what the buyer pays for one unit (the branded price), and not absurd.
 */
export function packMrpProblem(
  rupees: number,
  unitPricePaise: number,
): "missing" | "low" | "high" | null {
  if (!Number.isInteger(rupees) || rupees < 1) return "missing";
  if (rupees * 100 < unitPricePaise) return "low";
  if (rupees > MAX_PACK_MRP_RUPEES) return "high";
  return null;
}
