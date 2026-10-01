import "server-only";
import type { CoinReason, Prisma } from "@/generated/prisma/client";
import {
  coinsEarned,
  expiryFrom,
  maxRedemption,
  summariseCoins,
  type CoinRules,
  type CoinSummary,
  type Redemption,
} from "@/lib/coins";
import { logAdminAction } from "@/server/admin/audit";
import { getSetting } from "@/server/content/settings";
import { db } from "@/server/db";

// The Super Coins ledger (docs/CHUNKS.md, P1.7). Every credit and debit is a
// CoinLedger row; a balance is worked out from the rows (src/lib/coins.ts),
// never stored. Writes that depend on the balance first lock the user's row,
// so two checkouts at once can't spend the same coins. A row is unique per
// (user, reason, reference), so an event repeated by a double click or a
// replayed webhook counts once.

type Client = Prisma.TransactionClient;

function isUniqueClash(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

/** Serialises ledger writes for one user until the transaction ends. */
export async function lockUser(tx: Client, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
}

/**
 * Runs `work` in a transaction that reads the latest committed rows on every
 * statement (READ COMMITTED). Every transaction that decides something from
 * the ledger uses this, after lockUser(): under the default isolation a read
 * after the lock could still show the ledger as it was when the transaction
 * began, before another checkout committed, and two checkouts could spend the
 * same coins. It also avoids the gap locks a locking read on the ledger would
 * take, which can block other users' writes.
 */
export function ledgerTransaction<T>(work: (tx: Client) => Promise<T>): Promise<T> {
  return db.$transaction(work, { isolationLevel: "ReadCommitted" });
}

/** The balance, for a decision made under the user's lock (see ledgerTransaction). */
export const lockedSummary = (tx: Client, userId: string, now = new Date()) => coinSummary(tx, userId, now);

/** The user's balance, and when coins next expire. */
export async function coinSummary(
  client: Client | typeof db,
  userId: string,
  now = new Date(),
): Promise<CoinSummary> {
  const rows = await client.coinLedger.findMany({
    where: { userId },
    orderBy: { id: "asc" },
    select: { amount: true, createdAt: true, expiresAt: true },
  });
  return summariseCoins(rows, now);
}

/** What the user can use at checkout for items worth `subtotalPaise`. */
export async function checkoutOffer(
  userId: string,
  subtotalPaise: number,
  rules: CoinRules,
): Promise<Redemption & { balance: number }> {
  if (!rules.enabled) return { coins: 0, discountPaise: 0, balance: 0 };
  const { balance } = await coinSummary(db, userId);
  return { ...maxRedemption(balance, subtotalPaise, rules), balance };
}

type Credit = {
  userId: string;
  amount: number;
  reason: CoinReason;
  reference: string | null;
  note?: string | null;
  expiresAt?: Date | null;
  actorId?: string | null;
};

/** Writes one row; false if the same (user, reason, reference) is already there. */
async function write(tx: Client, entry: Credit): Promise<boolean> {
  try {
    await tx.coinLedger.create({
      data: {
        userId: entry.userId,
        amount: entry.amount,
        reason: entry.reason,
        reference: entry.reference,
        note: entry.note?.slice(0, 300) ?? null,
        expiresAt: entry.expiresAt ?? null,
        actorId: entry.actorId ?? null,
      },
    });
    return true;
  } catch (error) {
    if (isUniqueClash(error)) return false;
    throw error;
  }
}

// ─── Using coins at checkout ────────────────────────────────────────────────

/** The coins an order has on hold now: redeemed minus returned. */
async function heldFor(tx: Client, userId: string, orderId: string): Promise<{ held: number; rows: number }> {
  const rows = await tx.coinLedger.findMany({
    where: { userId, reason: { in: ["redeem", "redeem_return"] }, reference: { startsWith: `${orderId}:` } },
    select: { amount: true },
  });
  return { held: -rows.reduce((sum, row) => sum + row.amount, 0), rows: rows.length };
}

/**
 * Takes `coins` from the user's balance for an order. False, taking nothing,
 * if they no longer have that many. Does nothing (true) if the order already
 * holds them.
 */
export async function holdCoins(
  tx: Client,
  userId: string,
  orderId: string,
  coins: number,
): Promise<boolean> {
  if (coins <= 0) return true;
  await lockUser(tx, userId);
  const { held, rows } = await heldFor(tx, userId, orderId);
  if (held > 0) return true;
  const { balance } = await lockedSummary(tx, userId);
  if (balance < coins) return false;
  return write(tx, { userId, amount: -coins, reason: "redeem", reference: `${orderId}:${rows + 1}` });
}

/**
 * Gives an order's held coins back (payment failed, or the order was
 * cancelled). Does nothing if none are held, so it is safe to repeat. The
 * returned coins start a new expiry period.
 */
export async function releaseCoins(tx: Client, userId: string, orderId: string): Promise<number> {
  await lockUser(tx, userId);
  const { held, rows } = await heldFor(tx, userId, orderId);
  if (held <= 0) return 0;
  const rules = await getSetting("coins.rules");
  await write(tx, {
    userId,
    amount: held,
    reason: "redeem_return",
    reference: `${orderId}:${rows + 1}`,
    expiresAt: expiryFrom(new Date(), rules),
  });
  return held;
}

// ─── Earning ────────────────────────────────────────────────────────────────

/**
 * Credits an order's coins when its trigger happens: "delivered" if the rules
 * say earn after delivery, otherwise "paid". Once per order. Returns the
 * coins credited (0 if none, off, or already credited).
 */
export async function earnForOrder(orderId: string, trigger: "paid" | "delivered"): Promise<number> {
  const rules = await getSetting("coins.rules");
  if (!rules.enabled || rules.earnAfterDelivery !== (trigger === "delivered")) return 0;
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { userId: true, status: true, subtotalPaise: true, coinDiscountPaise: true },
  });
  if (!order?.userId || order.status === "cancelled" || order.status === "returned") return 0;
  const coins = coinsEarned(order.subtotalPaise - order.coinDiscountPaise, rules);
  if (coins <= 0) return 0;
  const userId = order.userId;
  return ledgerTransaction(async (tx) => {
    // The order first, then the user, as a cancel does; read again under the
    // lock because a cancel may have just finished.
    const fresh = await tx.$queryRaw<{ status: string }[]>`
      SELECT status FROM \`Order\` WHERE id = ${orderId} FOR UPDATE`;
    if (!fresh[0] || fresh[0].status === "cancelled" || fresh[0].status === "returned") return 0;
    await lockUser(tx, userId);
    const written = await write(tx, {
      userId,
      amount: coins,
      reason: "earn_order",
      reference: orderId,
      expiresAt: expiryFrom(new Date(), rules),
    });
    return written ? coins : 0;
  });
}

/**
 * Takes back the coins an order earned (when it is cancelled). Inside the
 * cancel's transaction. Once per order; nothing if it earned none.
 */
export async function reverseOrderEarnings(tx: Client, userId: string, orderId: string): Promise<number> {
  await lockUser(tx, userId);
  const earned = await tx.coinLedger.findFirst({
    where: { userId, reason: "earn_order", reference: orderId },
    select: { amount: true },
  });
  if (!earned) return 0;
  const amount = earned.amount;
  const written = await write(tx, {
    userId,
    amount: -amount,
    reason: "earn_reversal",
    reference: orderId,
  });
  return written ? amount : 0;
}

export type ProfileReward = "interests" | "details";

/** A profile-completion reward, once per user and kind. Returns the coins credited. */
export async function awardProfileReward(userId: string, kind: ProfileReward): Promise<number> {
  const rules = await getSetting("coins.rules");
  if (!rules.enabled) return 0;
  const coins = kind === "interests" ? rules.interestsReward : rules.detailsReward;
  if (coins <= 0) return 0;
  return ledgerTransaction(async (tx) => {
    await lockUser(tx, userId);
    const written = await write(tx, {
      userId,
      amount: coins,
      reason: "earn_profile",
      reference: kind,
      expiresAt: expiryFrom(new Date(), rules),
    });
    return written ? coins : 0;
  });
}

// ─── Admin adjustments ──────────────────────────────────────────────────────

export type AdjustResult =
  | { ok: true; balance: number }
  | { ok: false; error: "not_found" | "insufficient" };

/**
 * An admin's manual credit (positive) or debit (negative), with the reason
 * they gave, logged in AdminLog in the same transaction. A debit can't take
 * more than the balance.
 */
export async function adjustCoins(
  actorId: string,
  userId: string,
  amount: number,
  note: string,
): Promise<AdjustResult> {
  const rules = await getSetting("coins.rules");
  return ledgerTransaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return { ok: false, error: "not_found" } as const;
    await lockUser(tx, userId);
    const before = (await lockedSummary(tx, userId)).balance;
    if (before + amount < 0) return { ok: false, error: "insufficient" } as const;
    await write(tx, {
      userId,
      amount,
      reason: "admin_adjust",
      reference: null,
      note,
      expiresAt: amount > 0 ? expiryFrom(new Date(), rules) : null,
      actorId,
    });
    await logAdminAction(tx, {
      actorId,
      action: "coins.adjust",
      resource: "User",
      resourceId: userId,
      changes: { coins: { from: before, to: before + amount } },
      note,
    });
    return { ok: true, balance: before + amount } as const;
  });
}

// ─── Reading ────────────────────────────────────────────────────────────────

export type CoinHistoryItem = {
  id: number;
  amount: number;
  reason: CoinReason;
  reference: string | null;
  note: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  /** The order number, for entries about an order. */
  orderNumber: string | null;
};

export const COIN_PAGE_SIZE = 20;

/** The user's ledger, newest first. */
export async function readCoinHistory(
  userId: string,
  page: number,
): Promise<{ items: CoinHistoryItem[]; total: number }> {
  const [rows, total] = await Promise.all([
    db.coinLedger.findMany({
      where: { userId },
      orderBy: { id: "desc" },
      skip: (Math.max(1, page) - 1) * COIN_PAGE_SIZE,
      take: COIN_PAGE_SIZE,
    }),
    db.coinLedger.count({ where: { userId } }),
  ]);
  const orderIds = [
    ...new Set(
      rows.flatMap((row) =>
        row.reason === "earn_profile" || row.reason === "admin_adjust" || !row.reference
          ? []
          : [row.reference.split(":")[0]!],
      ),
    ),
  ];
  const orders = orderIds.length
    ? await db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, number: true } })
    : [];
  const numbers = new Map(orders.map((order) => [order.id, order.number]));
  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      reason: row.reason,
      reference: row.reference,
      note: row.note,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      orderNumber: row.reference ? (numbers.get(row.reference.split(":")[0]!) ?? null) : null,
    })),
  };
}

export type RecentCoinEntry = CoinHistoryItem & { userId: string; userName: string };

/** The newest ledger rows across users (admin), or for one user. */
export async function readRecentCoinActivity(take = 15, userId?: string): Promise<RecentCoinEntry[]> {
  const rows = await db.coinLedger.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { id: "desc" },
    take,
    include: { user: { select: { name: true } } },
  });
  const orderIds = [
    ...new Set(
      rows.flatMap((row) =>
        row.reason === "earn_profile" || row.reason === "admin_adjust" || !row.reference
          ? []
          : [row.reference.split(":")[0]!],
      ),
    ),
  ];
  const orders = orderIds.length
    ? await db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, number: true } })
    : [];
  const numbers = new Map(orders.map((order) => [order.id, order.number]));
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.user.name,
    amount: row.amount,
    reason: row.reason,
    reference: row.reference,
    note: row.note,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    orderNumber: row.reference ? (numbers.get(row.reference.split(":")[0]!) ?? null) : null,
  }));
}
