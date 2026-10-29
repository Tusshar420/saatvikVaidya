import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { brandThemeOf, type BrandThemeKey } from "@/lib/brand-theme";
import {
  brandLineTotal,
  brandUnitPriceFor,
  isValidBrandQuantity,
  MAX_BRAND_CART_LINES,
  MAX_BRAND_ORDER_PAISE,
  stepBrandQuantity,
} from "@/lib/brand";
import { computeTotals, type OrderTotals, type ShippingRule } from "@/server/checkout/totals";
import { db } from "@/server/db";
import { makeableByProduct } from "@/server/inventory/availability";
import { brandProductSelect, findBrandProduct, toBrandProduct, type BrandProduct } from "./drafts";

// The Launch cart (/launch, step 2): the products of one bulk branded order,
// each with a quantity in steps of its brand minimum. It is separate from the
// store cart, kept in the database for the signed-in user (so it survives
// sign-out and other devices), and never stores a price: every view and the
// order (./orders.ts) price the lines again, with the bulk tier each
// quantity reaches. Callers check the session and pass the user's id.

export type BrandCartLine = {
  productId: number;
  /** Name as it is now, also when the product is no longer open for branding. */
  name: string;
  quantity: number;
  /** The label colour theme chosen on the product page. */
  theme: BrandThemeKey;
  /** The MRP the buyer prints on one pack, in paise; null until entered. */
  packMrpPaise: number | null;
  /** Null when the product was taken off Build Your Brand or hidden. */
  product: BrandProduct | null;
  /** The quantity is allowed for the product's current terms and what can be made. */
  valid: boolean;
  /** Fewer can be made than the line asks for (or none): the line must be changed. */
  overStock: boolean;
  /** The price each at this quantity (its bulk tier), 0 when unavailable. */
  unitPricePaise: number;
  lineTotalPaise: number;
};

export type BrandCartView = {
  lines: BrandCartLine[];
  /** Units over all lines. */
  units: number;
  subtotalPaise: number;
  /** The whole cart is above the online limit (MAX_BRAND_ORDER_PAISE). */
  overLimit: boolean;
  /** Not empty, every line valid and within the limits: it can be ordered. */
  ready: boolean;
};

const cartSelect = {
  productId: true,
  quantity: true,
  labelTheme: true,
  packMrpPaise: true,
  product: { select: brandProductSelect },
} satisfies Prisma.BrandCartItemSelect;

/** The user's Launch cart, priced now, oldest line first. */
export async function readBrandCart(
  userId: string,
  client: Prisma.TransactionClient = db,
): Promise<BrandCartView> {
  const rows = await client.brandCartItem.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: cartSelect,
  });
  const makeable = await makeableByProduct(rows.map((row) => row.productId), client);
  const lines = rows.map((row): BrandCartLine => {
    const product = toBrandProduct(row.product, makeable.get(row.productId) ?? null);
    const overStock = product !== null && product.makeable !== null && row.quantity > product.makeable;
    const valid = product !== null && !overStock && isValidBrandQuantity(row.quantity, product.terms);
    const unitPricePaise = product ? brandUnitPriceFor(product.terms, row.quantity) : 0;
    return {
      productId: row.productId,
      name: row.product.name,
      quantity: row.quantity,
      theme: brandThemeOf(row.labelTheme).key,
      packMrpPaise: row.packMrpPaise,
      product,
      valid,
      overStock,
      unitPricePaise,
      lineTotalPaise: product ? brandLineTotal(product.terms, row.quantity) : 0,
    };
  });
  const subtotalPaise = lines.reduce((sum, line) => sum + line.lineTotalPaise, 0);
  const overLimit = subtotalPaise > MAX_BRAND_ORDER_PAISE;
  return {
    lines,
    units: lines.reduce((sum, line) => sum + (line.product ? line.quantity : 0), 0),
    subtotalPaise,
    overLimit,
    ready:
      lines.length > 0 &&
      lines.length <= MAX_BRAND_CART_LINES &&
      !overLimit &&
      lines.every((line) => line.valid),
  };
}

/** Products in the user's Launch cart (for the cart link). */
export async function brandCartCount(userId: string): Promise<number> {
  return db.brandCartItem.count({ where: { userId } });
}

/** Totals for the cart's available lines (GST is included in the prices). */
export function brandCartTotals(cart: Pick<BrandCartView, "lines">, shipping: ShippingRule): OrderTotals {
  return computeTotals(
    cart.lines.flatMap((line) =>
      line.product ? [{ lineTotalPaise: line.lineTotalPaise, gstRate: line.product.gstRate }] : [],
    ),
    shipping,
  );
}

export type BrandCartError =
  /** Unknown, hidden or not open for branding. */
  | { kind: "unavailable" }
  | { kind: "not_in_cart" }
  /** Not a positive multiple of the minimum (or above the per-product cap). */
  | { kind: "quantity"; minQty: number }
  /** Not enough components in stock to make this many (0: not even the minimum). */
  | { kind: "above_stock"; available: number }
  | { kind: "too_many_lines"; max: number }
  /** The cart would cost more than the online limit. */
  | { kind: "too_large" };

export type BrandCartChange =
  | { ok: true; quantity: number; count: number }
  | { ok: false; error: BrandCartError };

/** The cart's total with `productId` at `quantity`, priced now. */
async function totalWith(userId: string, productId: number, lineTotalPaise: number): Promise<number> {
  const cart = await readBrandCart(userId);
  return cart.lines.reduce(
    (sum, line) => sum + (line.productId === productId ? 0 : line.lineTotalPaise),
    lineTotalPaise,
  );
}

/**
 * "Add to launch cart": a product not in the cart comes in at its minimum;
 * one already there gets one more step of the minimum (as the + button).
 * `theme` is the label colour picked on the product page.
 */
export async function addToBrandCart(
  userId: string,
  productId: number,
  theme?: BrandThemeKey,
): Promise<BrandCartChange> {
  const product = await findBrandProduct(productId);
  if (!product) return { ok: false, error: { kind: "unavailable" } };
  const { terms } = product;
  const existing = await db.brandCartItem.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { quantity: true },
  });
  if (!existing && (await brandCartCount(userId)) >= MAX_BRAND_CART_LINES) {
    return { ok: false, error: { kind: "too_many_lines", max: MAX_BRAND_CART_LINES } };
  }
  const quantity = existing ? stepBrandQuantity(existing.quantity, terms, "up") : terms.minQty;
  if (!isValidBrandQuantity(quantity, terms) || (existing && quantity === existing.quantity)) {
    return { ok: false, error: { kind: "quantity", minQty: terms.minQty } };
  }
  if (product.makeable !== null && quantity > product.makeable) {
    return { ok: false, error: { kind: "above_stock", available: product.makeable } };
  }
  if ((await totalWith(userId, productId, brandLineTotal(terms, quantity))) > MAX_BRAND_ORDER_PAISE) {
    return { ok: false, error: { kind: "too_large" } };
  }
  await db.brandCartItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, quantity, labelTheme: theme ?? null },
    update: { quantity, ...(theme && { labelTheme: theme }) },
  });
  return { ok: true, quantity, count: await brandCartCount(userId) };
}

/**
 * "Continue — choose quantity" on a product's page: the product is in the
 * cart (at its minimum when new, as it is, with the new theme, when already
 * there) with the chosen theme. Unlike addToBrandCart this never raises the
 * quantity of a line that is already there.
 */
export async function chooseBrandProduct(
  userId: string,
  productId: number,
  theme: BrandThemeKey,
): Promise<BrandCartChange> {
  const existing = await db.brandCartItem.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { quantity: true },
  });
  if (!existing) return addToBrandCart(userId, productId, theme);
  const updated = await db.brandCartItem.updateMany({
    where: { userId, productId },
    data: { labelTheme: theme },
  });
  if (updated.count === 0) return { ok: false, error: { kind: "not_in_cart" } };
  return { ok: true, quantity: existing.quantity, count: await brandCartCount(userId) };
}

/** A new quantity for a line: a positive multiple of the product's minimum. */
export async function setBrandCartQuantity(
  userId: string,
  productId: number,
  quantity: number,
): Promise<BrandCartChange> {
  const existing = await db.brandCartItem.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: { kind: "not_in_cart" } };
  const product = await findBrandProduct(productId);
  if (!product) return { ok: false, error: { kind: "unavailable" } };
  if (!isValidBrandQuantity(quantity, product.terms)) {
    return { ok: false, error: { kind: "quantity", minQty: product.terms.minQty } };
  }
  if (product.makeable !== null && quantity > product.makeable) {
    return { ok: false, error: { kind: "above_stock", available: product.makeable } };
  }
  if ((await totalWith(userId, productId, brandLineTotal(product.terms, quantity))) > MAX_BRAND_ORDER_PAISE) {
    return { ok: false, error: { kind: "too_large" } };
  }
  // updateMany: the line may have been removed (or ordered) meanwhile.
  const updated = await db.brandCartItem.updateMany({ where: { userId, productId }, data: { quantity } });
  if (updated.count === 0) return { ok: false, error: { kind: "not_in_cart" } };
  return { ok: true, quantity, count: await brandCartCount(userId) };
}

/** Takes a product out of the cart (also one that is no longer available). */
export async function removeFromBrandCart(userId: string, productId: number): Promise<{ count: number }> {
  await db.brandCartItem.deleteMany({ where: { userId, productId } });
  return { count: await brandCartCount(userId) };
}

/**
 * The furthest /launch step the user may open: 1 products, 2 quantity and
 * brand, 3 delivery and payment. Step 3 needs a ready cart and the brand
 * details confirmed (a profile with a logo).
 */
export function furthestStep(
  cart: Pick<BrandCartView, "lines" | "ready">,
  draft: { packagingDone: boolean } | null,
  /** The brand profile the order uses (it needs a logo). */
  profile: { logo: unknown } | null,
): number {
  if (cart.lines.length === 0) return 1;
  if (!cart.ready) return 2;
  if (!draft?.packagingDone || !profile?.logo) return 2;
  return 3;
}
