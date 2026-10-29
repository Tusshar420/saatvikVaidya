import type { SettingValues } from "@/content/settings";

// Super Coins arithmetic (docs/CHUNKS.md, P1.7): pure functions with no
// database access, shared by the server and the pages, so the rules are easy
// to test. The ledger is in src/server/coins.

export type CoinRules = SettingValues["coins.rules"];

export type LedgerRow = {
  /** Positive: credit. Negative: debit. */
  amount: number;
  createdAt: Date;
  /** Credits stop counting after this moment; null never expires. */
  expiresAt: Date | null;
};

export type CoinSummary = {
  /** Coins that can be spent now. */
  balance: number;
  /** The soonest expiry among coins still held, with how many go then. */
  nextExpiry: { coins: number; at: Date } | null;
};

/**
 * The balance from the ledger rows, which must be in the order they were
 * written. Each credit is a lot; a debit uses the lots that expire soonest
 * (never-expiring last), skipping any that had already expired when the
 * debit was written; a debit larger than what was there takes only what
 * there was. Lots expired by `now` don't count.
 */
export function summariseCoins(rows: readonly LedgerRow[], now: Date): CoinSummary {
  const lots: { remaining: number; expiresAt: Date | null }[] = [];
  for (const row of rows) {
    if (row.amount > 0) {
      lots.push({ remaining: row.amount, expiresAt: row.expiresAt });
      continue;
    }
    let owed = -row.amount;
    const usable = lots
      .filter((lot) => lot.remaining > 0 && (!lot.expiresAt || lot.expiresAt > row.createdAt))
      .sort((a, b) => {
        if (!a.expiresAt || !b.expiresAt) return a.expiresAt ? -1 : b.expiresAt ? 1 : 0;
        return a.expiresAt.getTime() - b.expiresAt.getTime();
      });
    for (const lot of usable) {
      const taken = Math.min(lot.remaining, owed);
      lot.remaining -= taken;
      owed -= taken;
      if (owed === 0) break;
    }
  }
  let balance = 0;
  let next: { coins: number; at: Date } | null = null;
  const expiries = new Map<number, number>();
  for (const lot of lots) {
    if (lot.remaining <= 0) continue;
    if (lot.expiresAt && lot.expiresAt <= now) continue;
    balance += lot.remaining;
    if (lot.expiresAt) {
      const key = lot.expiresAt.getTime();
      expiries.set(key, (expiries.get(key) ?? 0) + lot.remaining);
    }
  }
  const soonest = Math.min(...expiries.keys());
  if (Number.isFinite(soonest)) next = { coins: expiries.get(soonest)!, at: new Date(soonest) };
  return { balance, nextExpiry: next };
}

/** When coins earned at `from` stop counting; null if they never expire. */
export function expiryFrom(from: Date, rules: Pick<CoinRules, "expiryMonths">): Date | null {
  if (rules.expiryMonths <= 0) return null;
  const at = new Date(from);
  at.setUTCMonth(at.getUTCMonth() + rules.expiryMonths);
  return at;
}

/** Coins earned on `basePaise` of items (the order's items after coins used). */
export function coinsEarned(basePaise: number, rules: CoinRules): number {
  if (!rules.enabled || basePaise <= 0) return 0;
  return Math.floor((basePaise * rules.earnPerThousandRupees) / 100_000);
}

/** The rupee value, in paise, of `coins`. */
export function coinValuePaise(coins: number, rules: Pick<CoinRules, "coinsPerRupee">): number {
  return Math.floor((coins * 100) / rules.coinsPerRupee);
}

export type Redemption = {
  /** Most coins this order can use, within the balance and the caps. */
  coins: number;
  /** What they take off the order, in paise. */
  discountPaise: number;
};

/**
 * The most coins an order of `subtotalPaise` (items, including GST) can use:
 * no more than the balance, the per-order coin cap, or the share of the items
 * total that may be paid with coins. Zero when the programme is off.
 */
export function maxRedemption(
  balance: number,
  subtotalPaise: number,
  rules: CoinRules,
): Redemption {
  if (!rules.enabled || balance <= 0 || subtotalPaise <= 0) return { coins: 0, discountPaise: 0 };
  const byShare = Math.floor(((subtotalPaise * rules.maxRedeemPercent) / 100) * rules.coinsPerRupee / 100);
  const coins = Math.max(0, Math.min(balance, rules.maxRedeemCoins, byShare));
  const discountPaise = coinValuePaise(coins, rules);
  // Only the coins that discount a whole paisa are used.
  const used = Math.ceil((discountPaise * rules.coinsPerRupee) / 100);
  return { coins: Math.min(coins, used), discountPaise };
}
