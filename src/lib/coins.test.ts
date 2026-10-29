import { describe, expect, it } from "vitest";
import { settingDefaults } from "@/content/settings";
import { allocateDiscount, computeTotals } from "@/server/checkout/totals";
import {
  coinsEarned,
  coinValuePaise,
  expiryFrom,
  maxRedemption,
  summariseCoins,
  type CoinRules,
} from "./coins";

const rules: CoinRules = settingDefaults["coins.rules"];
const at = (iso: string) => new Date(iso);
const row = (amount: number, createdAt: string, expiresAt: string | null = null) => ({
  amount,
  createdAt: at(createdAt),
  expiresAt: expiresAt ? at(expiresAt) : null,
});

describe("summariseCoins", () => {
  it("is the sum of credits and debits", () => {
    const rows = [row(500, "2026-01-01"), row(-200, "2026-01-02"), row(50, "2026-01-03")];
    expect(summariseCoins(rows, at("2026-02-01")).balance).toBe(350);
  });

  it("drops credits after they expire", () => {
    const rows = [row(500, "2026-01-01", "2026-06-01"), row(100, "2026-02-01", "2027-02-01")];
    expect(summariseCoins(rows, at("2026-05-31")).balance).toBe(600);
    expect(summariseCoins(rows, at("2026-06-01")).balance).toBe(100);
  });

  it("spends the coins that expire soonest first", () => {
    const rows = [
      row(100, "2026-01-01", "2026-06-01"),
      row(100, "2026-01-02", "2027-01-01"),
      row(100, "2026-01-03"),
      row(-100, "2026-01-04"),
    ];
    // The June coins were used, so only the later two remain after June.
    const after = summariseCoins(rows, at("2026-07-01"));
    expect(after.balance).toBe(200);
    expect(after.nextExpiry).toEqual({ coins: 100, at: at("2027-01-01") });
  });

  it("doesn't spend coins that had already expired when the debit was written", () => {
    const rows = [row(100, "2026-01-01", "2026-02-01"), row(100, "2026-01-05"), row(-100, "2026-03-01")];
    // The debit can only have used the never-expiring 100.
    expect(summariseCoins(rows, at("2026-03-02")).balance).toBe(0);
    const unused = [row(100, "2026-01-01", "2026-02-01"), row(-100, "2026-03-01")];
    expect(summariseCoins(unused, at("2026-03-02")).balance).toBe(0);
  });

  it("never goes below zero when a debit is bigger than what was there", () => {
    const rows = [row(100, "2026-01-01"), row(-300, "2026-01-02"), row(50, "2026-01-03")];
    expect(summariseCoins(rows, at("2026-02-01")).balance).toBe(50);
  });

  it("reports the next expiry with the coins that go then", () => {
    const rows = [row(100, "2026-01-01", "2026-06-01"), row(40, "2026-01-02", "2026-06-01"), row(10, "2026-01-02", "2027-06-01")];
    expect(summariseCoins(rows, at("2026-02-01")).nextExpiry).toEqual({ coins: 140, at: at("2026-06-01") });
    expect(summariseCoins([], at("2026-02-01"))).toEqual({ balance: 0, nextExpiry: null });
  });
});

describe("earning and value", () => {
  it("earns per ₹1,000 of items, rounded down", () => {
    expect(coinsEarned(1_000_000, rules)).toBe(1_000); // ₹10,000 → 1,000 coins
    expect(coinsEarned(64_000, rules)).toBe(64);
    expect(coinsEarned(999, rules)).toBe(0);
    expect(coinsEarned(1_000_000, { ...rules, enabled: false })).toBe(0);
  });

  it("values coins at the admin's rate", () => {
    expect(coinValuePaise(1_000, rules)).toBe(10_000); // 1,000 coins = ₹100
    expect(coinValuePaise(7, { coinsPerRupee: 4 })).toBe(175);
  });

  it("expires after the set number of months, or never", () => {
    expect(expiryFrom(at("2026-03-15T00:00:00Z"), { expiryMonths: 60 })).toEqual(at("2031-03-15T00:00:00Z"));
    expect(expiryFrom(at("2026-03-15"), { expiryMonths: 0 })).toBeNull();
  });
});

describe("maxRedemption", () => {
  it("is capped by the balance", () => {
    expect(maxRedemption(300, 1_000_000, rules)).toEqual({ coins: 300, discountPaise: 3_000 });
  });

  it("is capped by the share of the items total", () => {
    // 20% of ₹640 = ₹128 = 1,280 coins.
    expect(maxRedemption(50_000, 64_000, rules)).toEqual({ coins: 1_280, discountPaise: 12_800 });
  });

  it("is capped by the coins-per-order limit", () => {
    expect(maxRedemption(50_000, 100_000_000, rules)).toEqual({ coins: 5_000, discountPaise: 50_000 });
  });

  it("is nothing when the programme is off, or there's nothing to use or pay", () => {
    expect(maxRedemption(1_000, 64_000, { ...rules, enabled: false }).coins).toBe(0);
    expect(maxRedemption(0, 64_000, rules).coins).toBe(0);
    expect(maxRedemption(1_000, 0, rules).coins).toBe(0);
    expect(maxRedemption(1_000, 64_000, { ...rules, maxRedeemPercent: 0 }).coins).toBe(0);
  });

  it("uses only coins that take off a whole paisa", () => {
    // 3 coins per ₹1: 1 coin is 33 paise, 100 paise would need 3 coins.
    const odd = { ...rules, coinsPerRupee: 3, maxRedeemPercent: 100, maxRedeemCoins: 1_000 };
    const result = maxRedemption(10, 1_000, odd);
    expect(result.discountPaise).toBe(coinValuePaise(result.coins, odd));
    expect(result.coins).toBeLessThanOrEqual(10);
  });
});

describe("coin discount in totals", () => {
  it("spreads a discount over lines to the paisa, never past a line", () => {
    expect(allocateDiscount([10_000, 20_000], 3_000)).toEqual([1_000, 2_000]);
    const shares = allocateDiscount([3_333, 3_333, 3_334], 100);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    expect(allocateDiscount([100, 5_000], 99_999)).toEqual([100, 5_000]);
    expect(allocateDiscount([100], 0)).toEqual([0]);
  });

  it("takes the discount off the total and works GST out on what's left", () => {
    const lines = [{ lineTotalPaise: 10_500, gstRate: 5 }];
    const plain = computeTotals(lines, { feePaise: 8_000, freeFromPaise: null });
    expect(plain.taxPaise).toBe(500);
    const discounted = computeTotals(lines, { feePaise: 8_000, freeFromPaise: null }, 2_100);
    // ₹84 of goods left, with 5% GST inside: 8,400 − 400.
    expect(discounted.taxPaise).toBe(400);
    expect(discounted.gst).toEqual([{ rate: 5, taxablePaise: 8_000, taxPaise: 400 }]);
    expect(discounted.coinDiscountPaise).toBe(2_100);
    expect(discounted.subtotalPaise).toBe(10_500);
    expect(discounted.totalPaise).toBe(10_500 - 2_100 + 8_000);
  });

  it("decides free delivery before the discount", () => {
    const lines = [{ lineTotalPaise: 100_000, gstRate: 5 }];
    const totals = computeTotals(lines, { feePaise: 8_000, freeFromPaise: 99_900 }, 20_000);
    expect(totals.shippingPaise).toBe(0);
    expect(totals.totalPaise).toBe(80_000);
  });
});
