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
