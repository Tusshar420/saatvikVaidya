import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { upiLink } from "@/components/site/checkout/manual-payment";
import { settingDefaults } from "@/content/settings";
import { addToCart, readCart, type CartOwner } from "@/server/cart/cart";
import { placeOrder } from "@/server/checkout/orders";
import { createAddress, parseAddress } from "@/server/checkout/addresses";
import { resolveSetting } from "@/server/content/settings";
import { db } from "@/server/db";
import { getPaymentProvider } from "@/server/payments";
import { seedDatabase } from "@/server/seed";
import { captureMessages } from "../../../tests/setup/auth";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeProduct, makeUser, setStock, stockOf, validAddress } from "../../../tests/setup/shop";
import { cancelOrder } from "./orders";
import { markOrderPaid } from "./order-payment";

// Paying by QR code or bank transfer (PAYMENT_PROVIDER=manual): the order
// waits until an admin marks it paid, and that goes through completePayment.

const shipping = { feePaise: 8_000, freeFromPaise: 99_900 };
const customer = { kind: "customer", professional: false, bulk: false } as const;

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
  captureMessages();
  vi.stubEnv("PAYMENT_PROVIDER", "manual");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await db.$disconnect();
});

async function manualOrder(stock = 10) {
  const product = await makeProduct(db, { stock });
  const userId = await makeUser(db, { type: "customer", verificationStatus: "none" });
  const parsed = parseAddress(validAddress);
  if (!parsed.success) throw new Error("fixture should be valid");
  const address = await createAddress(userId, parsed.data);
  if (!address.ok) throw new Error("address not created");
  const owner: CartOwner = { kind: "user", userId };
  await addToCart(owner, product.id, 2);
  const cart = await readCart(owner, customer, shipping);
  const placed = await placeOrder({
    userId,
    viewer: customer,
    addressId: address.id,
    checkoutKey: randomUUID(),
    expectedTotalPaise: cart.totals.totalPaise,
    shipping,
  });
  if (!placed.ok) throw new Error(`order refused: ${placed.error}`);
  const admin = await makeUser(db, { type: "customer", verificationStatus: "none" });
  return { orderId: placed.orderId, productId: product.id, admin };
}

describe("manual payment provider", () => {
  it("is available, makes its own references, and never reports a result from the browser", async () => {
    const provider = getPaymentProvider({ PAYMENT_PROVIDER: "manual" });
    expect(provider.name).toBe("manual");
    expect(provider.isAvailable()).toBe(true);
    const { reference } = await provider.createPayment({ orderId: "o", orderNumber: "SV-1", amountPaise: 100, attempt: 1 });
    expect(reference).toMatch(/^manual_[0-9a-f]{24}$/);
    await expect(provider.verifyPayment(reference, { outcome: "success" })).rejects.toThrow();
  });
});

describe("markOrderPaid", () => {
  it("pays the order once: stock taken, a log row written, a second click changes nothing", async () => {
    const { orderId, productId, admin } = await manualOrder();
    expect((await db.payment.findFirstOrThrow({ where: { orderId } })).provider).toBe("manual");
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("pending_payment");

    expect(await markOrderPaid(admin, orderId)).toEqual({ ok: true, changed: true });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
    expect(order.status).toBe("paid");
    expect(order.payments[0]?.status).toBe("succeeded");
    expect(await stockOf(db, productId)).toBe(8);
    const log = await db.adminLog.findMany({ where: { resourceId: orderId, action: "order.mark_paid" } });
    expect(log).toHaveLength(1);
    expect(log[0]?.userId).toBe(admin);

    expect(await markOrderPaid(admin, orderId)).toEqual({ ok: true, changed: false });
    expect(await db.adminLog.count({ where: { resourceId: orderId, action: "order.mark_paid" } })).toBe(1);
    expect(await stockOf(db, productId)).toBe(8);
  });

  it("refuses a cancelled order, an unknown order and a payment that isn't manual", async () => {
    const { orderId, admin } = await manualOrder();
    expect(await markOrderPaid(admin, "not-an-order")).toEqual({ ok: false, error: "not_found" });

    await db.payment.updateMany({ where: { orderId }, data: { provider: "test" } });
    expect(await markOrderPaid(admin, orderId)).toEqual({ ok: false, error: "not_manual" });
    await db.payment.updateMany({ where: { orderId }, data: { provider: "manual" } });

    expect((await cancelOrder(admin, orderId)).ok).toBe(true);
    expect(await markOrderPaid(admin, orderId)).toEqual({ ok: false, error: "not_pending" });
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("cancelled");
  });

  it("reports out_of_stock, and takes nothing, when the stock went before the money arrived", async () => {
    const { orderId, productId, admin } = await manualOrder(10);
    // The customer was slow to pay: the hold lapsed and the stock went elsewhere.
    await db.stockReservation.updateMany({
      where: { refType: "order", refId: orderId },
      data: { status: "released" },
    });
    await setStock(db, productId, 1);
    expect(await markOrderPaid(admin, orderId)).toEqual({ ok: false, error: "out_of_stock" });
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("payment_failed");
    expect(await stockOf(db, productId)).toBe(1);
  });
});

describe("payment details setting", () => {
  it("has empty defaults and accepts valid UPI, account and IFSC values", () => {
    expect(settingDefaults["payment.manual"].upiId).toBe("");
    const good = { ...settingDefaults["payment.manual"], upiId: "saatvik@okaxis", accountNumber: "123456789012", ifsc: "HDFC0001234" };
    expect(resolveSetting("payment.manual", good)).toEqual(good);
  });

  it("falls back to the default when a stored value is invalid", () => {
    const bad = { ...settingDefaults["payment.manual"], upiId: "not a upi id", ifsc: "abc" };
    expect(resolveSetting("payment.manual", bad)).toEqual(settingDefaults["payment.manual"]);
  });

  it("builds a UPI link with the amount in rupees and the order number as the note", () => {
    const url = new URL(upiLink({ upiId: "saatvik@okaxis", payeeName: "Saatvik Vaidya" }, 123_450, "SV-100"));
    expect(url.protocol).toBe("upi:");
    expect(url.searchParams.get("pa")).toBe("saatvik@okaxis");
    expect(url.searchParams.get("am")).toBe("1234.50");
    expect(url.searchParams.get("cu")).toBe("INR");
    expect(url.searchParams.get("tn")).toBe("SV-100");
  });
});
