// Inventory units and the small rules the server and the admin screens share.
// Quantities are whole numbers of a base unit: pieces, millilitres or grams.
// Litres and kilograms are only for typing and showing. No server imports:
// client components use this too.

export const stockUnits = ["pcs", "ml", "g"] as const;
export type StockUnitKey = (typeof stockUnits)[number];

export const stockKinds = ["finished", "packaging", "base"] as const;
export type StockKindKey = (typeof stockKinds)[number];

export const movementTypes = [
  "receipt",
  "sale",
  "reservation",
  "release",
  "consumption",
  "return",
  "adjustment",
  "expiry_write_off",
] as const;
export type MovementTypeKey = (typeof movementTypes)[number];

/** Packaging kinds the admin can pick for a component. */
export const componentTypes = ["bottle", "tube", "jar", "pouch", "cap", "box", "label", "base", "other"] as const;
export type ComponentTypeKey = (typeof componentTypes)[number];

/** A batch with this many days (or fewer) left is "expiring soon". */
export const EXPIRY_WARN_DAYS = 60;

/** Most we accept for one quantity (keeps sums inside a 32-bit column). */
export const MAX_STOCK_QUANTITY = 1_000_000_000;

/** The units a quantity can be typed in for each base unit. */
export const entryUnits: Record<StockUnitKey, { key: string; factor: number }[]> = {
  pcs: [{ key: "pcs", factor: 1 }],
  ml: [
    { key: "ml", factor: 1 },
    { key: "L", factor: 1000 },
  ],
  g: [
    { key: "g", factor: 1 },
    { key: "kg", factor: 1000 },
  ],
};

/** "1,250 pcs", "2.5 L", "800 ml", "1.2 kg". */
export function formatQuantity(quantity: number, unit: StockUnitKey): string {
  const group = (value: number) => value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (unit === "ml" && Math.abs(quantity) >= 1000) return `${group(quantity / 1000)} L`;
  if (unit === "g" && Math.abs(quantity) >= 1000) return `${group(quantity / 1000)} kg`;
  return `${group(quantity)} ${unit}`;
}

/**
 * A typed amount ("2.5" with entry unit "L") as whole base units, or null if
 * it isn't a positive-or-zero number that comes out whole.
 */
export function toBaseQuantity(amount: string, entryUnit: string, unit: StockUnitKey): number | null {
  const factor = entryUnits[unit].find((entry) => entry.key === entryUnit)?.factor;
  if (!factor) return null;
  const text = amount.trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d{1,3})?$/.test(text)) return null;
  const value = Math.round(Number(text) * factor);
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_STOCK_QUANTITY) return null;
  return value;
}

/** Whole days from `today` to `expiry` (negative once expired); null without a date. */
export function daysToExpiry(expiry: Date | null, today: Date = new Date()): number | null {
  if (!expiry) return null;
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const end = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
  return Math.round((end - start) / 86_400_000);
}

export type ExpiryState = "none" | "ok" | "soon" | "expired";

export function expiryState(expiry: Date | null, today: Date = new Date()): ExpiryState {
  const days = daysToExpiry(expiry, today);
  if (days === null) return "none";
  if (days < 0) return "expired";
  return days <= EXPIRY_WARN_DAYS ? "soon" : "ok";
}

/** Whether `available` has reached the item's alert level (0 turns the alert off). */
export function isLow(available: number, lowThreshold: number): boolean {
  return lowThreshold > 0 && available <= lowThreshold;
}

export type RecipeNeed = { componentId: number; quantity: number; madeToOrder: boolean; available: number };

/**
 * How many units can be made from the components' available stock: the
 * smallest "available / per unit" over the recipe, ignoring made-to-order
 * bases. Null when nothing limits it (no recipe, or only made-to-order
 * lines). The result is rounded down to a multiple of `step` (the item's
 * minimum order, which is also its step), so it is always an orderable amount.
 */
export function unitsMakeable(lines: readonly RecipeNeed[], step: number): number | null {
  const limiting = lines.filter((line) => !line.madeToOrder && line.quantity > 0);
  if (limiting.length === 0) return null;
  const raw = Math.min(...limiting.map((line) => Math.floor(Math.max(0, line.available) / line.quantity)));
  const size = Math.max(1, step);
  return Math.floor(raw / size) * size;
}
