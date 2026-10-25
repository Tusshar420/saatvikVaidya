import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { componentLinesFor } from "./availability";
import {
  StockError,
  commitReservations,
  releaseReservations,
  reserveStock,
  returnSale,
  type StockRef,
} from "./engine";

// How orders use the stock engine (src/server/inventory/engine.ts).
//
// Store (B2C) orders:
//   payment starts  -> reserveOrderStock   (held for HOLD_MINUTES)
//   payment succeeds-> takeOrderStock      (the hold becomes a sale)
//   payment fails / order cancelled unpaid -> releaseOrderStock
//   paid order cancelled or refunded       -> returnOrderStock (same batches)
//
// Launch (B2B) orders, whose recipes name the components:
//   order paid (confirmed)   -> reserveBrandOrder (may go past what is in
//                               stock: a paid order must be made)
//   production starts        -> consumeBrandOrder
//   cancelled before that    -> releaseBrandOrder

type Tx = Prisma.TransactionClient;

/** How long a store order holds its stock while waiting for payment. */
export const HOLD_MINUTES = 30;

/** Orders paid outside the site (a call from the team, QR, bank transfer) hold their stock for a day. */
export const OFFLINE_HOLD_MINUTES = 24 * 60;

export const orderRef = (orderId: string): StockRef => ({ type: "order", id: orderId });
export const brandOrderRef = (orderId: string): StockRef => ({ type: "brand_order", id: orderId });

type ProductLine = { productId: number; quantity: number };

async function itemIdsFor(tx: Tx, lines: readonly ProductLine[]): Promise<{ itemId: number; quantity: number }[]> {
  const items = await tx.stockItem.findMany({
    where: { productId: { in: lines.map((line) => line.productId) } },
    select: { id: true, productId: true },
  });
  return lines.map((line) => {
    const item = items.find((candidate) => candidate.productId === line.productId);
    // A product without a stock item has nothing to sell.
    if (!item) throw new StockError("insufficient", { itemId: 0, available: 0 });
    return { itemId: item.id, quantity: line.quantity };
  });
}

/** Holds the products' stock for an order whose payment is starting. */
export async function reserveOrderStock(
  tx: Tx,
  orderId: string,
  lines: readonly ProductLine[],
  holdMinutes: number = HOLD_MINUTES,
): Promise<void> {
  await reserveStock(tx, await itemIdsFor(tx, lines), orderRef(orderId), {
    expiresAt: new Date(Date.now() + holdMinutes * 60_000),
  });
}

/**
 * The payment succeeded: the hold becomes a sale. A hold that lapsed meanwhile
 * is taken again now, and fails with StockError("insufficient") if the stock
 * has gone.
 */
export async function takeOrderStock(tx: Tx, orderId: string, lines: readonly ProductLine[]): Promise<void> {
  const ref = orderRef(orderId);
  const wanted = await itemIdsFor(tx, lines);
  const held = await tx.stockReservation.groupBy({
    by: ["itemId"],
    where: { refType: ref.type, refId: ref.id, status: "active" },
    _sum: { quantity: true },
  });
  const missing = wanted.filter(
    (line) => (held.find((row) => row.itemId === line.itemId)?._sum.quantity ?? 0) < line.quantity,
  );
  for (const line of missing) await releaseReservations(tx, ref, "Hold replaced", line.itemId);
  if (missing.length > 0) await reserveStock(tx, missing, ref);
  await commitReservations(tx, ref, "sale");
}

/** Payment failed or the unpaid order was cancelled: the stock is free again. */
export async function releaseOrderStock(tx: Tx, orderId: string, reason: string): Promise<void> {
  await releaseReservations(tx, orderRef(orderId), reason);
}

/** A paid order was cancelled or refunded: the stock goes back to its batches. */
export async function returnOrderStock(tx: Tx, orderId: string, userId: string | null, reason: string): Promise<boolean> {
  return (await returnSale(tx, orderRef(orderId), { userId, reason })) > 0;
}

// ─── Launch (brand) orders ──────────────────────────────────────────────────

async function brandLines(tx: Tx, orderId: string): Promise<ProductLine[]> {
  const items = await tx.orderItem.findMany({
    where: { orderId, kind: "product", productId: { not: null } },
    select: { productId: true, quantity: true },
  });
  return items.flatMap((item) => (item.productId === null ? [] : [{ productId: item.productId, quantity: item.quantity }]));
}

/** A Launch order was confirmed (paid): hold the components its recipes need. */
export async function reserveBrandOrder(tx: Tx, orderId: string): Promise<void> {
  const lines = await componentLinesFor(await brandLines(tx, orderId), tx);
  await reserveStock(tx, lines, brandOrderRef(orderId), { allowShortfall: true });
}

/** Production started: the held components are used up. */
export async function consumeBrandOrder(tx: Tx, orderId: string): Promise<number> {
  return commitReservations(tx, brandOrderRef(orderId), "consumption");
}

/** The order was cancelled before production: the components are free again. */
export async function releaseBrandOrder(tx: Tx, orderId: string): Promise<void> {
  await releaseReservations(tx, brandOrderRef(orderId), "Order cancelled");
}
