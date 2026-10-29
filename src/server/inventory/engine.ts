import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { StockKind, StockMovementType } from "@/generated/prisma/client";
import { MAX_STOCK_QUANTITY, daysToExpiry } from "@/lib/inventory";

// The stock engine, shared by both inventories (docs: "Inventory" entry in
// docs/PROGRESS.md). Every function takes the caller's transaction, so a
// stock change and the order or admin action that caused it commit together.
//
// - On hand, reserved and available (= on hand - reserved) live on the
//   StockItem. A "finished" item (B2C) also keeps them per StockBatch and is
//   sold first-expiry-first-out; components (B2B) have no batches.
// - A reservation holds stock for a reference (an order); it is later
//   committed (a sale, or production consuming components) or released.
// - Every change writes a StockMovement: the item's full history.
// - Items are locked in id order, so two orders at once can't deadlock and
//   the last units go to whoever locks first.

type Tx = Prisma.TransactionClient;

/** What a reservation is for: a store order, or a Launch (brand) order. */
export type StockRef = { type: "order" | "brand_order"; id: string };

export type StockErrorCode =
  | "insufficient"
  | "invalid_quantity"
  | "reason_required"
  | "no_item"
  | "no_batch"
  | "batch_clash"
  | "below_reserved"
  | "not_expired"
  | "nothing_to_write_off"
  | "batch_required";

export class StockError extends Error {
  constructor(
    readonly code: StockErrorCode,
    /** For "insufficient": the item that ran short and how much it has. */
    readonly detail?: { itemId: number; available: number },
  ) {
    super(code);
  }
}

/** Today as a UTC date (batches carry dates, not times). */
function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function whole(quantity: number, { allowNegative = false } = {}): number {
  if (!Number.isInteger(quantity) || Math.abs(quantity) > MAX_STOCK_QUANTITY) {
    throw new StockError("invalid_quantity");
  }
  if (!allowNegative && quantity <= 0) throw new StockError("invalid_quantity");
  return quantity;
}

type LockedItem = { id: number; kind: StockKind; onHand: number; reserved: number };

/** Locks the items (in id order) and returns them. Unknown ids are an error. */
async function lockItems(tx: Tx, ids: readonly number[]): Promise<Map<number, LockedItem>> {
  const unique = [...new Set(ids)].sort((a, b) => a - b);
  if (unique.length === 0) return new Map();
  const rows = await tx.$queryRaw<LockedItem[]>`
    SELECT id, kind, onHand, reserved FROM StockItem
    WHERE id IN (${Prisma.join(unique)}) ORDER BY id FOR UPDATE`;
  if (rows.length !== unique.length) throw new StockError("no_item");
  return new Map(rows.map((row) => [row.id, row]));
}

type Movement = {
  itemId: number;
  batchId?: number | null;
  type: StockMovementType;
  quantity: number;
  onHandDelta: number;
  reservedDelta: number;
  reason?: string | null;
  ref?: StockRef | null;
  userId?: string | null;
};

/** Moves the item's counters and writes the movement; returns the new on-hand. */
async function applyMovement(tx: Tx, movement: Movement): Promise<number> {
  const item = await tx.stockItem.update({
    where: { id: movement.itemId },
    data: {
      onHand: { increment: movement.onHandDelta },
      reserved: { increment: movement.reservedDelta },
    },
    select: { onHand: true },
  });
  await tx.stockMovement.create({
    data: {
      itemId: movement.itemId,
      batchId: movement.batchId ?? null,
      type: movement.type,
      quantity: movement.quantity,
      onHandDelta: movement.onHandDelta,
      reservedDelta: movement.reservedDelta,
      onHandAfter: item.onHand,
      reason: movement.reason?.slice(0, 300) || null,
      refType: movement.ref?.type ?? null,
      refId: movement.ref?.id ?? null,
      userId: movement.userId ?? null,
    },
  });
  return item.onHand;
}

// ─── Reservations ───────────────────────────────────────────────────────────

export type ReserveOptions = {
  /** A hold on a store order lapses if payment never completes. */
  expiresAt?: Date | null;
  /**
   * Components only: reserve even beyond what's available (a paid Launch
   * order must be made; the shortfall shows as negative available and is a
   * signal to buy more).
   */
  allowShortfall?: boolean;
};

/**
 * Holds `lines` for `ref`. Finished items are taken first-expiry-first-out
 * from batches that haven't expired. Throws StockError("insufficient") for
 * the first item that can't be covered; the caller's transaction then rolls
 * back, so nothing is half-reserved.
 */
export async function reserveStock(
  tx: Tx,
  lines: readonly { itemId: number; quantity: number }[],
  ref: StockRef,
  options: ReserveOptions = {},
): Promise<void> {
  const wanted = new Map<number, number>();
  for (const line of lines) wanted.set(line.itemId, (wanted.get(line.itemId) ?? 0) + whole(line.quantity));
  const items = await lockItems(tx, [...wanted.keys()]);
  for (const [itemId, quantity] of [...wanted].sort(([a], [b]) => a - b)) {
    const item = items.get(itemId)!;
    // Holds that lapsed give their stock back before this one is counted.
    await releaseLapsed(tx, itemId);
    if (item.kind === "finished") {
      await reserveFromBatches(tx, itemId, quantity, ref, options.expiresAt ?? null);
    } else {
      const current = await tx.stockItem.findUniqueOrThrow({
        where: { id: itemId },
        select: { onHand: true, reserved: true },
      });
      const available = current.onHand - current.reserved;
      if (quantity > available && !options.allowShortfall) {
        throw new StockError("insufficient", { itemId, available: Math.max(0, available) });
      }
      await tx.stockReservation.create({
        data: { itemId, quantity, refType: ref.type, refId: ref.id, expiresAt: options.expiresAt ?? null },
      });
      await applyMovement(tx, {
        itemId,
        type: "reservation",
        quantity,
        onHandDelta: 0,
        reservedDelta: quantity,
        ref,
      });
    }
  }
}

async function reserveFromBatches(
  tx: Tx,
  itemId: number,
  quantity: number,
  ref: StockRef,
  expiresAt: Date | null,
): Promise<void> {
  // First expiry first; batches without a date last. Expired ones aren't sold.
  const batches = await tx.$queryRaw<{ id: number; free: number }[]>`
    SELECT id, qtyOnHand - qtyReserved AS free FROM StockBatch
    WHERE itemId = ${itemId} AND qtyOnHand > qtyReserved
      AND (expiryDate IS NULL OR expiryDate >= ${today()})
    ORDER BY expiryDate IS NULL, expiryDate, id FOR UPDATE`;
  const total = batches.reduce((sum, batch) => sum + Number(batch.free), 0);
  if (total < quantity) throw new StockError("insufficient", { itemId, available: total });
  let left = quantity;
  for (const batch of batches) {
    if (left === 0) break;
    const take = Math.min(left, Number(batch.free));
    left -= take;
    await tx.stockBatch.update({ where: { id: batch.id }, data: { qtyReserved: { increment: take } } });
    await tx.stockReservation.create({
      data: { itemId, batchId: batch.id, quantity: take, refType: ref.type, refId: ref.id, expiresAt },
    });
    await applyMovement(tx, {
      itemId,
      batchId: batch.id,
      type: "reservation",
      quantity: take,
      onHandDelta: 0,
      reservedDelta: take,
      ref,
    });
  }
}

type ReservationRow = { id: number; itemId: number; batchId: number | null; quantity: number };

/** Claims and releases the given active reservations. */
async function releaseRows(
  tx: Tx,
  rows: readonly ReservationRow[],
  ref: StockRef | null,
  reason: string | null,
): Promise<number> {
  let released = 0;
  for (const row of [...rows].sort((a, b) => a.itemId - b.itemId || a.id - b.id)) {
    const claimed = await tx.stockReservation.updateMany({
      where: { id: row.id, status: "active" },
      data: { status: "released" },
    });
    if (claimed.count === 0) continue;
    released += 1;
    if (row.batchId) {
      await tx.stockBatch.update({ where: { id: row.batchId }, data: { qtyReserved: { decrement: row.quantity } } });
    }
    await applyMovement(tx, {
      itemId: row.itemId,
      batchId: row.batchId,
      type: "release",
      quantity: row.quantity,
      onHandDelta: 0,
      reservedDelta: -row.quantity,
      reason,
      ref,
    });
  }
  return released;
}

/** Gives back the stock of holds whose time is up (for one item, or all). */
export async function releaseLapsed(tx: Tx, itemId?: number): Promise<number> {
  const rows = await tx.stockReservation.findMany({
    where: { status: "active", expiresAt: { lt: new Date() }, ...(itemId ? { itemId } : {}) },
    select: { id: true, itemId: true, batchId: true, quantity: true, refType: true, refId: true },
  });
  let released = 0;
  for (const row of rows) {
    released += await releaseRows(tx, [row], { type: row.refType as StockRef["type"], id: row.refId }, "Hold lapsed");
  }
  return released;
}

/** Releases everything still held for `ref` (or for one item of it). Idempotent. */
export async function releaseReservations(
  tx: Tx,
  ref: StockRef,
  reason: string | null = null,
  itemId?: number,
): Promise<number> {
  const rows = await tx.stockReservation.findMany({
    where: { refType: ref.type, refId: ref.id, status: "active", ...(itemId ? { itemId } : {}) },
    select: { id: true, itemId: true, batchId: true, quantity: true },
  });
  return releaseRows(tx, rows, ref, reason);
}

/** Whether `ref` still holds stock. */
export async function hasActiveReservations(tx: Tx, ref: StockRef): Promise<boolean> {
  return (await tx.stockReservation.count({ where: { refType: ref.type, refId: ref.id, status: "active" } })) > 0;
}

/**
 * Turns the holds for `ref` into real stock movements: a sale (store order)
 * or consumption (production using up components). Applied once: the holds
 * are claimed, so a second call finds none and returns 0.
 */
export async function commitReservations(tx: Tx, ref: StockRef, type: "sale" | "consumption"): Promise<number> {
  const rows = await tx.stockReservation.findMany({
    where: { refType: ref.type, refId: ref.id, status: "active" },
    select: { id: true, itemId: true, batchId: true, quantity: true },
    orderBy: [{ itemId: "asc" }, { id: "asc" }],
  });
  await lockItems(tx, rows.map((row) => row.itemId));
  let committed = 0;
  for (const row of rows) {
    const claimed = await tx.stockReservation.updateMany({
      where: { id: row.id, status: "active" },
      data: { status: "consumed" },
    });
    if (claimed.count === 0) continue;
    committed += 1;
    // A component reserved beyond its stock can only use what is there; the
    // shortfall is recorded, and the rest of the hold is dropped.
    let used = row.quantity;
    let reason: string | null = null;
    if (!row.batchId) {
      const item = await tx.stockItem.findUniqueOrThrow({ where: { id: row.itemId }, select: { onHand: true } });
      used = Math.max(0, Math.min(row.quantity, item.onHand));
      if (used < row.quantity) reason = `Short: ${used} of ${row.quantity} was in stock`;
    }
    if (row.batchId) {
      await tx.stockBatch.update({
        where: { id: row.batchId },
        data: { qtyOnHand: { decrement: used }, qtyReserved: { decrement: row.quantity } },
      });
    }
    await applyMovement(tx, {
      itemId: row.itemId,
      batchId: row.batchId,
      type,
      quantity: used,
      onHandDelta: -used,
      reservedDelta: -row.quantity,
      reason,
      ref,
    });
  }
  return committed;
}

/**
 * A cancelled or refunded sale puts its stock back, into the same batches it
 * came from. Applied once per reference.
 */
export async function returnSale(
  tx: Tx,
  ref: StockRef,
  options: { reason?: string | null; userId?: string | null } = {},
): Promise<number> {
  const already = await tx.stockMovement.count({ where: { refType: ref.type, refId: ref.id, type: "return" } });
  if (already > 0) return 0;
  const sales = await tx.stockMovement.findMany({
    where: { refType: ref.type, refId: ref.id, type: "sale" },
    select: { itemId: true, batchId: true, quantity: true },
    orderBy: [{ itemId: "asc" }, { id: "asc" }],
  });
  await lockItems(tx, sales.map((sale) => sale.itemId));
  for (const sale of sales) {
    if (sale.batchId) {
      await tx.stockBatch.update({ where: { id: sale.batchId }, data: { qtyOnHand: { increment: sale.quantity } } });
    }
    await applyMovement(tx, {
      itemId: sale.itemId,
      batchId: sale.batchId,
      type: "return",
      quantity: sale.quantity,
      onHandDelta: sale.quantity,
      reservedDelta: 0,
      reason: options.reason ?? null,
      ref,
      userId: options.userId ?? null,
    });
  }
  return sales.length;
}

// ─── Stock-room work ────────────────────────────────────────────────────────

export type ReceiveInput = {
  itemId: number;
  quantity: number;
  /** Finished items: the batch number (a new one is made if left out). */
  batchNo?: string | null;
  mfgDate?: Date | null;
  expiryDate?: Date | null;
  unitCostPaise?: number | null;
  reason?: string | null;
  userId?: string | null;
};

/** Stock arrives: a new batch (or more of an existing one) for a finished item. */
export async function receiveStock(tx: Tx, input: ReceiveInput): Promise<{ batchId: number | null }> {
  const quantity = whole(input.quantity);
  const items = await lockItems(tx, [input.itemId]);
  const item = items.get(input.itemId)!;
  let batchId: number | null = null;
  if (item.kind === "finished") {
    const batchNo = input.batchNo?.trim() || (await nextBatchNo(tx, input.itemId));
    const existing = await tx.stockBatch.findUnique({
      where: { itemId_batchNo: { itemId: input.itemId, batchNo } },
    });
    if (existing) {
      const sameExpiry =
        !input.expiryDate || (existing.expiryDate !== null && +existing.expiryDate === +input.expiryDate);
      if (!sameExpiry) throw new StockError("batch_clash");
      await tx.stockBatch.update({
        where: { id: existing.id },
        data: {
          qtyOnHand: { increment: quantity },
          ...(input.expiryDate && !existing.expiryDate ? { expiryDate: input.expiryDate } : {}),
          ...(input.mfgDate && !existing.mfgDate ? { mfgDate: input.mfgDate } : {}),
        },
      });
      batchId = existing.id;
    } else {
      const created = await tx.stockBatch.create({
        data: {
          itemId: input.itemId,
          batchNo,
          mfgDate: input.mfgDate ?? null,
          expiryDate: input.expiryDate ?? null,
          qtyOnHand: quantity,
          unitCostPaise: input.unitCostPaise ?? null,
        },
      });
      batchId = created.id;
    }
  }
  if (input.unitCostPaise != null) {
    await tx.stockItem.update({ where: { id: input.itemId }, data: { purchaseCostPaise: input.unitCostPaise } });
  }
  await applyMovement(tx, {
    itemId: input.itemId,
    batchId,
    type: "receipt",
    quantity,
    onHandDelta: quantity,
    reservedDelta: 0,
    reason: input.reason ?? null,
    userId: input.userId ?? null,
  });
  return { batchId };
}

async function nextBatchNo(tx: Tx, itemId: number): Promise<string> {
  const stamp = today().toISOString().slice(0, 10).replace(/-/g, "");
  const count = await tx.stockBatch.count({ where: { itemId, batchNo: { startsWith: `B${stamp}` } } });
  return `B${stamp}-${count + 1}`;
}

export type AdjustInput = {
  itemId: number;
  /** Finished items: which batch is being corrected. */
  batchId?: number | null;
  /** Positive adds, negative removes. */
  delta: number;
  /** Required: why (count correction, damage, loss...). */
  reason: string;
  userId: string;
};

/** A manual correction, with the reason and the admin who made it. */
export async function adjustStock(tx: Tx, input: AdjustInput): Promise<void> {
  const delta = whole(input.delta, { allowNegative: true });
  if (delta === 0) throw new StockError("invalid_quantity");
  const reason = input.reason.trim();
  if (!reason) throw new StockError("reason_required");
  const items = await lockItems(tx, [input.itemId]);
  const item = items.get(input.itemId)!;
  if (item.kind === "finished") {
    if (!input.batchId) throw new StockError("batch_required");
    const batch = await tx.stockBatch.findFirst({ where: { id: input.batchId, itemId: input.itemId } });
    if (!batch) throw new StockError("no_batch");
    if (batch.qtyOnHand + delta < batch.qtyReserved) throw new StockError("below_reserved");
    await tx.stockBatch.update({ where: { id: batch.id }, data: { qtyOnHand: { increment: delta } } });
  } else if (item.onHand + delta < 0) {
    throw new StockError("below_reserved");
  }
  await applyMovement(tx, {
    itemId: input.itemId,
    batchId: item.kind === "finished" ? input.batchId : null,
    type: "adjustment",
    quantity: Math.abs(delta),
    onHandDelta: delta,
    reservedDelta: 0,
    reason,
    userId: input.userId,
  });
}

/** Writes off what is left (and not held) of an expired batch. */
export async function writeOffExpired(
  tx: Tx,
  input: { batchId: number; userId: string; reason?: string | null },
): Promise<number> {
  const found = await tx.stockBatch.findUnique({ where: { id: input.batchId }, select: { itemId: true } });
  if (!found) throw new StockError("no_batch");
  await lockItems(tx, [found.itemId]);
  const batch = await tx.stockBatch.findUniqueOrThrow({ where: { id: input.batchId } });
  const days = daysToExpiry(batch.expiryDate);
  if (days === null || days >= 0) throw new StockError("not_expired");
  const quantity = batch.qtyOnHand - batch.qtyReserved;
  if (quantity <= 0) throw new StockError("nothing_to_write_off");
  await tx.stockBatch.update({ where: { id: batch.id }, data: { qtyOnHand: { decrement: quantity } } });
  await applyMovement(tx, {
    itemId: batch.itemId,
    batchId: batch.id,
    type: "expiry_write_off",
    quantity,
    onHandDelta: -quantity,
    reservedDelta: 0,
    reason: input.reason?.trim() || `Batch ${batch.batchNo} expired`,
    userId: input.userId,
  });
  return quantity;
}

/**
 * Makes sure a finished item exists for a product (a new product, or one
 * made before inventory) and returns its id.
 */
export async function ensureProductItem(
  tx: Tx,
  product: { id: number; name: string },
): Promise<number> {
  const found = await tx.stockItem.findUnique({ where: { productId: product.id }, select: { id: true } });
  if (found) return found.id;
  const created = await tx.stockItem.create({
    data: { kind: "finished", name: product.name.slice(0, 160), unit: "pcs", productId: product.id },
    select: { id: true },
  });
  return created.id;
}
