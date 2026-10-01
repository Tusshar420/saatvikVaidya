import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { settingDefaults } from "@/content/settings";
import { decideVerification } from "@/server/admin/users";
import { cancelOrder } from "@/server/admin/orders";
import { retryPayment, startPaymentAttempt } from "@/server/checkout/orders";
import { completePayment } from "@/server/checkout/payments";
import { db } from "@/server/db";
import { issueInvoice } from "@/server/invoices/invoices";
import { seedDatabase } from "@/server/seed";
import { createShipment, simulateShipmentStep } from "@/server/shipping/shipments";
import { captureMessages } from "../../../tests/setup/auth";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin, makeOrder } from "../../../tests/setup/orders";
import { makeUser } from "../../../tests/setup/shop";
import {
  adjustCoins,
  awardProfileReward,
  checkoutOffer,
  coinSummary,
  earnForOrder,
  readCoinHistory,
} from "./ledger";
import { updateCoinRules } from "./rules";

// Super Coins (P1.7): earning (when paid or after delivery, once), using
// coins at checkout within the caps, giving them back on a failed payment or
// a cancellation, expiry, rewards and manual adjustments.

let adminId: string;

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
  await db.setting.update({
    where: { key: "coins.rules" },
    data: { value: settingDefaults["coins.rules"] },
  });
  captureMessages();
  adminId = await makeAdmin(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const balance = async (userId: string) => (await coinSummary(db, userId)).balance;
const giveCoins = (userId: string, amount: number, expiresAt: Date | null = null) =>
  db.coinLedger.create({ data: { userId, amount, reason: "admin_adjust", note: "test", expiresAt } });
const setRules = (patch: Partial<(typeof settingDefaults)["coins.rules"]>) =>
  updateCoinRules(adminId, { ...settingDefaults["coins.rules"], ...patch });

/** Moves the order's shipment through every step to delivered. */
async function deliver(orderId: string) {
  await createShipment(adminId, orderId);
  let status = "created" as Parameters<typeof simulateShipmentStep>[3];
  while (status !== "delivered") {
    const result = await simulateShipmentStep(adminId, orderId, "next", status);
    if (!result.ok) throw new Error(`step failed: ${result.error}`);
    status = result.status;
  }
}

describe("earning", () => {
  it("credits after delivery by default, once, and not before", async () => {
    const order = await makeOrder(db); // 2 × ₹320 = ₹640 → 64 coins
    expect(await balance(order.userId)).toBe(0);
    await deliver(order.orderId);
    expect(await balance(order.userId)).toBe(64);
    // Delivered again (a replay): no second credit.
    expect(await earnForOrder(order.orderId, "delivered")).toBe(0);
    expect(await balance(order.userId)).toBe(64);

    const entry = await db.coinLedger.findFirstOrThrow({ where: { userId: order.userId } });
    expect(entry).toMatchObject({ reason: "earn_order", reference: order.orderId, amount: 64 });
    expect(entry.expiresAt).toBeInstanceOf(Date);
  });

  it("credits on payment when the rules say so, and the delivery then adds nothing", async () => {
    await setRules({ earnAfterDelivery: false });
    const order = await makeOrder(db);
    expect(await balance(order.userId)).toBe(64);
    await deliver(order.orderId);
    expect(await balance(order.userId)).toBe(64);
  });

  it("earns nothing when the programme is off", async () => {
    await setRules({ enabled: false, earnAfterDelivery: false });
    const order = await makeOrder(db);
    expect(await balance(order.userId)).toBe(0);
    expect(await awardProfileReward(order.userId, "details")).toBe(0);
  });

  it("earns on the items after coins were used, not on delivery", async () => {
    const userId = await makeUser(db);
    await giveCoins(userId, 5_000);
    const order = await makeOrder(db, { userId, redeemCoins: true });
    await deliver(order.orderId);
    // ₹640 items − ₹128 of coins = ₹512 → 51 coins (rounded down).
    const earned = await db.coinLedger.findFirstOrThrow({ where: { userId, reason: "earn_order" } });
    expect(earned.amount).toBe(51);
  });

  it("gives the profile rewards once each", async () => {
    const userId = await makeUser(db);
    expect(await awardProfileReward(userId, "interests")).toBe(250);
    expect(await awardProfileReward(userId, "interests")).toBe(0);
    expect(await awardProfileReward(userId, "details")).toBe(750);
    expect(await balance(userId)).toBe(1_000);
  });

  it("credits the 'details' reward when a professional is approved", async () => {
    const userId = await makeUser(db, { type: "doctor", verificationStatus: "pending" });
    await decideVerification([userId], "approved", null, adminId);
    expect(await balance(userId)).toBe(750);
    await decideVerification([userId], "approved", null, adminId);
    expect(await balance(userId)).toBe(750);
  });
});

describe("using coins at checkout", () => {
  it("takes coins and the discount off the order, within the share cap", async () => {
    const userId = await makeUser(db);
    await giveCoins(userId, 2_000);
    const order = await makeOrder(db, { userId, redeemCoins: true });
    const row = await db.order.findUniqueOrThrow({
      where: { id: order.orderId },
      include: { items: true },
    });
    // 20% of ₹640 = ₹128 = 1,280 coins.
    expect(row).toMatchObject({ coinsRedeemed: 1_280, coinDiscountPaise: 12_800, subtotalPaise: 64_000 });
    expect(row.totalPaise).toBe(64_000 - 12_800 + 8_000);
    expect(row.items.reduce((sum, item) => sum + item.discountPaise, 0)).toBe(12_800);
    expect(row.taxPaise).toBe(row.items.reduce((sum, item) => sum + item.taxPaise, 0));
    expect(await balance(userId)).toBe(720);
    const debit = await db.coinLedger.findFirstOrThrow({ where: { userId, reason: "redeem" } });
    expect(debit).toMatchObject({ amount: -1_280 });
  });

  it("uses only the balance when it is lower than the caps", async () => {
    const userId = await makeUser(db);
    await giveCoins(userId, 100);
    const order = await makeOrder(db, { userId, redeemCoins: true });
    const row = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(row).toMatchObject({ coinsRedeemed: 100, coinDiscountPaise: 1_000 });
    expect(await balance(userId)).toBe(0);
  });

  it("respects the per-order coin cap and a changed coin value", async () => {
    await setRules({ maxRedeemCoins: 300, coinsPerRupee: 5, maxRedeemPercent: 100 });
    const userId = await makeUser(db);
    await giveCoins(userId, 2_000);
    const offer = await checkoutOffer(userId, 64_000, await db.setting.findUniqueOrThrow({ where: { key: "coins.rules" } }).then((s) => s.value as typeof settingDefaults["coins.rules"]));
    expect(offer).toMatchObject({ coins: 300, discountPaise: 6_000 });
  });

  it("uses nothing when the buyer doesn't ask, or the programme is off", async () => {
    const userId = await makeUser(db);
    await giveCoins(userId, 2_000);
    const plain = await makeOrder(db, { userId });
    expect(await db.order.findUniqueOrThrow({ where: { id: plain.orderId } })).toMatchObject({
      coinsRedeemed: 0,
      coinDiscountPaise: 0,
    });
    expect(await balance(userId)).toBe(2_000);

    await setRules({ enabled: false });
    const off = await makeOrder(db, { userId, redeemCoins: true });
    expect((await db.order.findUniqueOrThrow({ where: { id: off.orderId } })).coinsRedeemed).toBe(0);
    expect(await balance(userId)).toBe(2_000);
  });

  it("can't spend the same coins on two orders at once", async () => {
    const userId = await makeUser(db);
    await giveCoins(userId, 1_000);
    const results = await Promise.allSettled([
      makeOrder(db, { userId, redeemCoins: true, pay: false }),
      makeOrder(db, { userId, redeemCoins: true, pay: false }),
    ]);
    // Both are placed from the same balance. One uses the coins; the other
    // is refused ("changed") or gets none, and the ledger never goes negative.
    expect(await balance(userId)).toBeGreaterThanOrEqual(0);
    const debits = await db.coinLedger.findMany({ where: { userId, reason: "redeem" } });
    expect(debits.reduce((sum, row) => sum - row.amount, 0)).toBeLessThanOrEqual(1_000);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
  });

  it("doesn't spend coins that have expired", async () => {
    const userId = await makeUser(db);
    await giveCoins(userId, 2_000, new Date(Date.now() - 86_400_000));
    expect(await balance(userId)).toBe(0);
    const order = await makeOrder(db, { userId, redeemCoins: true });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.orderId } })).coinsRedeemed).toBe(0);
  });

  it("puts the coin discount on the invoice, so it adds up to what was paid", async () => {
    const userId = await makeUser(db);
    await giveCoins(userId, 2_000);
    const order = await makeOrder(db, { userId, redeemCoins: true });
    const invoice = await db.invoice.findFirstOrThrow({ where: { orderId: order.orderId, kind: "invoice" } });
    const row = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(invoice.totalPaise).toBe(row.totalPaise);
    expect(await issueInvoice(order.orderId)).toBeDefined();
  });
});

describe("giving coins back", () => {
  it("returns them when the payment fails, and takes them again on a retry", async () => {
    const userId = await makeUser(db);
    await giveCoins(userId, 2_000);
    const order = await makeOrder(db, { userId, redeemCoins: true, pay: false });
    expect(await balance(userId)).toBe(720);

    const attempt = await startPaymentAttempt(order.orderId);
    await completePayment({ reference: attempt!.reference, outcome: "failed", failureReason: "declined" });
    expect(await balance(userId)).toBe(2_000);
    // Repeating the failure doesn't return twice.
    await completePayment({ reference: attempt!.reference, outcome: "failed", failureReason: "declined" });
    expect(await balance(userId)).toBe(2_000);

    const next = await retryPayment(userId, order.orderId);
    expect(next?.attempt).toBe(2);
    expect(await balance(userId)).toBe(720);
    await completePayment({ reference: next!.reference, outcome: "succeeded" });
    expect(await balance(userId)).toBe(720);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.orderId } })).status).toBe("paid");
  });

  it("won't retry if the coins were spent meanwhile", async () => {
    const userId = await makeUser(db);
    await giveCoins(userId, 1_300);
    const order = await makeOrder(db, { userId, redeemCoins: true, pay: false });
    const attempt = await startPaymentAttempt(order.orderId);
    await completePayment({ reference: attempt!.reference, outcome: "failed" });
    await adjustCoins(adminId, userId, -1_000, "spent elsewhere");
    expect(await retryPayment(userId, order.orderId)).toBeNull();
    expect((await db.order.findUniqueOrThrow({ where: { id: order.orderId } })).status).toBe("payment_failed");
  });

  it("returns them when an unpaid or a paid order is cancelled, once", async () => {
    const userId = await makeUser(db);
    await giveCoins(userId, 2_000);
    const unpaid = await makeOrder(db, { userId, redeemCoins: true, pay: false });
    expect(await balance(userId)).toBe(720);
    await cancelOrder(adminId, unpaid.orderId);
    await cancelOrder(adminId, unpaid.orderId);
    expect(await balance(userId)).toBe(2_000);

    // The unpaid order's items are still in the cart; start the next one clean.
    await db.cartItem.deleteMany({ where: { cart: { userId } } });
    const paid = await makeOrder(db, { userId, redeemCoins: true });
    expect(await balance(userId)).toBe(720);
    await cancelOrder(adminId, paid.orderId);
    expect(await balance(userId)).toBe(2_000);
    const returns = await db.coinLedger.count({ where: { userId, reason: "redeem_return" } });
    expect(returns).toBe(2);
  });

  it("takes back what a paid order earned when it is cancelled", async () => {
    await setRules({ earnAfterDelivery: false });
    const order = await makeOrder(db);
    expect(await balance(order.userId)).toBe(64);
    await cancelOrder(adminId, order.orderId);
    expect(await balance(order.userId)).toBe(0);
    await cancelOrder(adminId, order.orderId);
    expect(await balance(order.userId)).toBe(0);
    expect(await db.coinLedger.count({ where: { userId: order.userId, reason: "earn_reversal" } })).toBe(1);
  });

  it("gives returned coins a fresh expiry", async () => {
    const userId = await makeUser(db);
    await giveCoins(userId, 2_000, new Date(Date.now() + 86_400_000));
    const order = await makeOrder(db, { userId, redeemCoins: true, pay: false });
    await cancelOrder(adminId, order.orderId);
    const back = await db.coinLedger.findFirstOrThrow({ where: { userId, reason: "redeem_return" } });
    expect(back.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 365 * 86_400_000);
  });
});

describe("admin adjustments", () => {
  it("credits and debits with a reason, and logs it", async () => {
    const userId = await makeUser(db);
    expect(await adjustCoins(adminId, userId, 500, "Goodwill")).toEqual({ ok: true, balance: 500 });
    expect(await adjustCoins(adminId, userId, -200, "Correction")).toEqual({ ok: true, balance: 300 });
    const log = await db.adminLog.findMany({ where: { action: "coins.adjust", resourceId: userId }, orderBy: { id: "asc" } });
    expect(log).toHaveLength(2);
    expect(log[0]!.changes).toMatchObject({ coins: { from: 0, to: 500 }, note: "Goodwill" });
    const entry = await db.coinLedger.findFirstOrThrow({ where: { userId, amount: -200 } });
    expect(entry).toMatchObject({ reason: "admin_adjust", note: "Correction", actorId: adminId });
  });

  it("refuses to take the balance below zero, and unknown users", async () => {
    const userId = await makeUser(db);
    await adjustCoins(adminId, userId, 100, "Start");
    expect(await adjustCoins(adminId, userId, -101, "Too much")).toEqual({ ok: false, error: "insufficient" });
    expect(await balance(userId)).toBe(100);
    expect(await adjustCoins(adminId, "nobody", 10, "Nope")).toEqual({ ok: false, error: "not_found" });
  });
});

describe("history and rules", () => {
  it("lists a user's ledger newest first, with order numbers", async () => {
    const userId = await makeUser(db);
    await giveCoins(userId, 2_000);
    const order = await makeOrder(db, { userId, redeemCoins: true });
    const { items, total } = await readCoinHistory(userId, 1);
    expect(total).toBe(2);
    expect(items[0]).toMatchObject({ reason: "redeem", amount: -1_280, orderNumber: order.number });
    expect(items[1]).toMatchObject({ reason: "admin_adjust", amount: 2_000 });
  });

  it("saves the rules with history and a log, and refuses nonsense", async () => {
    await setRules({ coinsPerRupee: 20, expiryMonths: 12 });
    const stored = await db.setting.findUniqueOrThrow({ where: { key: "coins.rules" } });
    expect(stored.value).toMatchObject({ coinsPerRupee: 20, expiryMonths: 12 });
    expect(await db.settingHistory.count({ where: { settingKey: "coins.rules" } })).toBeGreaterThan(0);
    const log = await db.adminLog.findFirstOrThrow({ where: { action: "coins.rules.update" } });
    expect(log.changes).toMatchObject({ coinsPerRupee: { from: 10, to: 20 } });
    await expect(setRules({ coinsPerRupee: 0 })).rejects.toThrow();
    vi.restoreAllMocks();
  });
});
