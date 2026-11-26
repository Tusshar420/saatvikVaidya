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

/** A product's own names for its label variants; missing ones use the default. */
export type VariantNames = Partial<Record<BrandThemeKey, string>>;

/** Stored variant names as a lookup; rows for unknown variants are ignored. */
export function toVariantNames(rows: { variant: string; name: string }[]): VariantNames {
  const names: VariantNames = {};
  for (const row of rows) {
    const key = brandThemeKeys.find((known) => known === row.variant);
    if (key) names[key] = row.name;
  }
  return names;
}

/**
 * The name to show for a variant: the product's own name when it has one,
 * else the default (`defaults`, from src/content/brand.ts). Unknown keys
 * (an old order) show as stored.
 */
export function variantName(
  key: string,
  names: VariantNames | undefined,
  defaults: Record<string, string>,
): string {
  return names?.[key as BrandThemeKey] || defaults[key] || key;
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
