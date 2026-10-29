import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { unitsMakeable } from "@/lib/inventory";
import { db } from "@/server/db";
import { releaseLapsed } from "./engine";

// What can be sold or ordered right now, from the stock engine.
// - Store (B2C): the available units of a product's batches that haven't
//   expired (a held or expired unit isn't for sale).
// - Launch (B2B): how many units can be made from the available components,
//   per the product's recipe (see unitsMakeable in src/lib/inventory.ts).

type Client = Pick<typeof db, "$queryRaw" | "product" | "stockItem">;

/** Gives back the stock of store-order holds whose time is up. Cheap when none are. */
export async function sweepLapsedHolds(): Promise<void> {
  const lapsed = await db.stockReservation.count({ where: { status: "active", expiresAt: { lt: new Date() } } });
  if (lapsed === 0) return;
  await db.$transaction((tx) => releaseLapsed(tx));
}

/** Units on sale for each product (0 for a product without stock). */
export async function sellableByProduct(
  productIds: readonly number[],
  client: Pick<typeof db, "$queryRaw"> = db,
): Promise<Map<number, number>> {
  const result = new Map<number, number>(productIds.map((id) => [id, 0]));
  if (productIds.length === 0) return result;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const rows = await client.$queryRaw<{ productId: number; free: bigint | number | string | null }[]>`
    SELECT i.productId AS productId, COALESCE(SUM(b.qtyOnHand - b.qtyReserved), 0) AS free
    FROM StockItem i
    LEFT JOIN StockBatch b ON b.itemId = i.id AND (b.expiryDate IS NULL OR b.expiryDate >= ${start})
    WHERE i.productId IN (${Prisma.join([...productIds])}) AND i.active = true
    GROUP BY i.productId`;
  for (const row of rows) result.set(row.productId, Math.max(0, Number(row.free)));
  return result;
}

export async function sellableOf(productId: number, client: Pick<typeof db, "$queryRaw"> = db): Promise<number> {
  return (await sellableByProduct([productId], client)).get(productId) ?? 0;
}

/**
 * Launch units that can be made for each product: null when nothing limits it
 * (no recipe yet, or only made-to-order bases), otherwise a multiple of the
 * product's minimum order.
 */
export async function makeableByProduct(
  productIds: readonly number[],
  client: Pick<Client, "product"> = db,
): Promise<Map<number, number | null>> {
  const result = new Map<number, number | null>(productIds.map((id) => [id, null]));
  if (productIds.length === 0) return result;
  const products = await client.product.findMany({
    where: { id: { in: [...productIds] } },
    select: {
      id: true,
      brandMinQty: true,
      recipeLines: {
        select: { quantity: true, component: { select: { id: true, onHand: true, reserved: true, madeToOrder: true } } },
      },
    },
  });
  for (const product of products) {
    result.set(
      product.id,
      unitsMakeable(
        product.recipeLines.map((line) => ({
          componentId: line.component.id,
          quantity: line.quantity,
          madeToOrder: line.component.madeToOrder,
          available: line.component.onHand - line.component.reserved,
        })),
        product.brandMinQty ?? 1,
      ),
    );
  }
  return result;
}

export type ComponentShortfall = { componentId: number; name: string; needed: number; available: number };

/**
 * Components a whole Launch order needs, added up across its lines (two
 * products can share a bottle), that the stock can't cover. Empty when the
 * order can be made.
 */
export async function componentShortfalls(
  lines: readonly { productId: number; quantity: number }[],
  client: Pick<Client, "product"> = db,
): Promise<ComponentShortfall[]> {
  if (lines.length === 0) return [];
  const products = await client.product.findMany({
    where: { id: { in: lines.map((line) => line.productId) } },
    select: {
      id: true,
      recipeLines: {
        select: { quantity: true, component: { select: { id: true, name: true, onHand: true, reserved: true, madeToOrder: true } } },
      },
    },
  });
  const needed = new Map<number, ComponentShortfall>();
  for (const line of lines) {
    const product = products.find((candidate) => candidate.id === line.productId);
    for (const recipe of product?.recipeLines ?? []) {
      if (recipe.component.madeToOrder) continue;
      const entry = needed.get(recipe.component.id) ?? {
        componentId: recipe.component.id,
        name: recipe.component.name,
        needed: 0,
        available: recipe.component.onHand - recipe.component.reserved,
      };
      entry.needed += recipe.quantity * line.quantity;
      needed.set(recipe.component.id, entry);
    }
  }
  return [...needed.values()].filter((entry) => entry.needed > Math.max(0, entry.available));
}

/** The component lines a Launch order reserves: recipe quantity x units, summed per component. */
export async function componentLinesFor(
  lines: readonly { productId: number; quantity: number }[],
  client: Pick<Client, "product"> = db,
): Promise<{ itemId: number; quantity: number }[]> {
  if (lines.length === 0) return [];
  const products = await client.product.findMany({
    where: { id: { in: lines.map((line) => line.productId) } },
    select: { id: true, recipeLines: { select: { componentId: true, quantity: true, component: { select: { madeToOrder: true } } } } },
  });
  const total = new Map<number, number>();
  for (const line of lines) {
    const product = products.find((candidate) => candidate.id === line.productId);
    for (const recipe of product?.recipeLines ?? []) {
      // A made-to-order base is made for the order; there is nothing to hold.
      if (recipe.component.madeToOrder) continue;
      total.set(recipe.componentId, (total.get(recipe.componentId) ?? 0) + recipe.quantity * line.quantity);
    }
  }
  return [...total].map(([itemId, quantity]) => ({ itemId, quantity }));
}
