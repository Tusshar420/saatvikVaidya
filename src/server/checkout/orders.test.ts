import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addToCart, readCart, type CartOwner } from "@/server/cart/cart";
import { db } from "@/server/db";
import type { Message } from "@/server/notify";
import type { PricingViewer } from "@/server/pricing/rules";
import { seedDatabase } from "@/server/seed";
import { captureMessages } from "../../../tests/setup/auth";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeProduct, makeUser, setStock, stockOf, validAddress } from "../../../tests/setup/shop";
import { createAddress, parseAddress } from "./addresses";
import { placeOrder, readOrderForUser, retryPayment, startPaymentAttempt } from "./orders";
import { completePayment } from "./payments";

// Orders and the test payment (P1.4): prices worked out again on the
// server, a snapshot on the order, and payment results applied exactly once.

const shipping = { feePaise: 8_000, freeFromPaise: 99_900 };
const customer: PricingViewer = { kind: "customer", professional: false, bulk: false };
const doctor: PricingViewer = { kind: "professional", professional: true, bulk: false };

let sent: Message[];

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
  sent = captureMessages();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await db.$disconnect();
});

/** A user with one saved address and the given products in their cart. */
async function shopper(lines: { productId: number; quantity: number }[], type = "customer") {
  const userId = await makeUser(db, {
    type,
    verificationStatus: type === "customer" ? "none" : "approved",
  });
  const parsed = parseAddress(validAddress);
  if (!parsed.success) throw new Error("fixture should be valid");
  const address = await createAddress(userId, parsed.data);
  if (!address.ok) throw new Error("address not created");
  const owner: CartOwner = { kind: "user", userId };
  for (const line of lines) {
    const added = await addToCart(owner, line.productId, line.quantity);
    if (!added.ok) throw new Error(`not added: ${JSON.stringify(added.error)}`);
  }
  return { userId, addressId: address.id, owner };
}

/** placeOrder with the total the checkout page would have shown. */
async function place(
  who: { userId: string; addressId: number; owner: CartOwner },
  viewer: PricingViewer = customer,
  overrides: Partial<Parameters<typeof placeOrder>[0]> = {},
) {
  const cart = await readCart(who.owner, viewer, shipping);
  return placeOrder({
    userId: who.userId,
    viewer,
    addressId: who.addressId,
    checkoutKey: randomUUID(),
    expectedTotalPaise: cart.totals.totalPaise,
    shipping,
    ...overrides,
  });
}

async function placed(...args: Parameters<typeof place>) {
  const result = await place(...args);
  if (!result.ok) throw new Error(`order refused: ${result.error}`);
  return result.orderId;
}

async function livePayment(orderId: string) {
  return db.payment.findFirstOrThrow({ where: { orderId, status: "created" } });
}

const succeed = async (orderId: string, ownerId?: string) =>
  completePayment({ reference: (await livePayment(orderId)).reference, outcome: "succeeded" }, ownerId);
const decline = async (orderId: string) =>
  completePayment({
    reference: (await livePayment(orderId)).reference,
    outcome: "failed",
    failureReason: "declined",
  });

describe("placeOrder", () => {
  it("prices the cart on the server, snapshots it with the address, and opens attempt 1", async () => {
    const product = await makeProduct(db, { mrpPaise: 32_000, professionalPricePaise: 24_000, stock: 10 });
    const who = await shopper([{ productId: product.id, quantity: 2 }], "doctor");
    const orderId = await placed(who, doctor);

    const order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, payments: true },
    });
    expect(order).toMatchObject({
      userId: who.userId,
      status: "pending_payment",
      shipName: "Asha Rao",
      shipPhone: "+919876543210",
      shipCity: "Pune",
      shipState: "MH",
      shipPincode: "411001",
      subtotalPaise: 48_000,
      taxPaise: 2_286,
      shippingPaise: 8_000,
      totalPaise: 56_000,
      paidAt: null,
    });
    expect(order.number).toMatch(/^SV-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(order.items).toMatchObject([
      {
        productId: product.id,
        productSlug: product.slug,
        quantity: 2,
        unitPaise: 24_000,
        mrpPaise: 32_000,
        priceTier: "professional",
        lineTotalPaise: 48_000,
        gstRate: 5,
        taxPaise: 2_286,
        hsnCode: "30049011",
      },
    ]);
    expect(order.payments).toMatchObject([
      { provider: "test", attempt: 1, status: "created", amountPaise: 56_000 },
    ]);
    // Nothing is taken until the payment succeeds.
    expect(await stockOf(db, product.id)).toBe(10);
    expect((await readCart(who.owner, doctor, shipping)).lines).toHaveLength(1);
  });

  it("keeps the snapshot when the product changes later", async () => {
    const product = await makeProduct(db, { mrpPaise: 10_000 });
    const who = await shopper([{ productId: product.id, quantity: 1 }]);
    const orderId = await placed(who);
    await db.product.update({ where: { id: product.id }, data: { mrpPaise: 99_000, name: "Renamed" } });
    const view = await readOrderForUser(who.userId, orderId);
    expect(view?.items[0]).toMatchObject({ productName: expect.stringMatching(/^Test product/), unitPaise: 10_000 });
  });

  it("places one order for a repeated checkout key, even at the same moment", async () => {
    const product = await makeProduct(db);
    const who = await shopper([{ productId: product.id, quantity: 1 }]);
    const cart = await readCart(who.owner, customer, shipping);
    const input = {
      userId: who.userId,
      viewer: customer,
      addressId: who.addressId,
      checkoutKey: randomUUID(),
      expectedTotalPaise: cart.totals.totalPaise,
      shipping,
    };
    const [a, b] = await Promise.all([placeOrder(input), placeOrder(input)]);
    const again = await placeOrder(input);
    expect(a.ok && b.ok && again.ok).toBe(true);
    if (!a.ok || !b.ok || !again.ok) return;
    expect(new Set([a.orderId, b.orderId, again.orderId]).size).toBe(1);
    expect(await db.order.count({ where: { userId: who.userId } })).toBe(1);
    expect(await db.payment.count({ where: { orderId: a.orderId } })).toBe(1);
  });

  it("refuses an empty cart, someone else's address, and a cart that changed", async () => {
    const product = await makeProduct(db, { stock: 5, mrpPaise: 10_000 });
    const who = await shopper([{ productId: product.id, quantity: 3 }]);
    const stranger = await shopper([]);

    expect(await place(stranger)).toEqual({ ok: false, error: "empty" });
    expect(await place(who, customer, { addressId: stranger.addressId })).toEqual({
      ok: false,
      error: "address",
    });
    // The page showed a different total (the price changed since).
    expect(await place(who, customer, { expectedTotalPaise: 1 })).toEqual({
      ok: false,
      error: "cart_changed",
    });
    // Stock fell below the cart's quantity.
    await setStock(db, product.id, 2);
    expect(await place(who)).toEqual({ ok: false, error: "cart_changed" });
    await setStock(db, product.id, 5);
    await db.product.update({ where: { id: product.id }, data: { active: false } });
    expect(await place(who)).toEqual({ ok: false, error: "cart_changed" });
    expect(await db.order.count()).toBe(0);
  });

  it("refuses when the test provider can't run (production)", async () => {
    const product = await makeProduct(db);
    const who = await shopper([{ productId: product.id, quantity: 1 }]);
    vi.stubEnv("NODE_ENV", "production");
    expect(await place(who)).toEqual({ ok: false, error: "payments_off" });
    expect(await db.order.count()).toBe(0);
  });

  it("paying by QR or bank transfer empties the cart when the order is placed", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "manual");
    const product = await makeProduct(db, { stock: 10 });
    const who = await shopper([{ productId: product.id, quantity: 2 }]);
    const orderId = await placed(who);

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
    expect(order.status).toBe("pending_payment");
    expect(order.payments).toMatchObject([{ provider: "manual", status: "created" }]);
    expect((await readCart(who.owner, customer, shipping)).lines).toHaveLength(0);
    // The stock is still only held until staff mark it paid.
    expect(await stockOf(db, product.id)).toBe(10);
  });
});

describe("placeOrder with PAYMENT_PROVIDER=request", () => {
  it("places the order with no payment screen details, empties the cart and lets an admin mark it paid later", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "request");
    const product = await makeProduct(db, { stock: 10 });
    const who = await shopper([{ productId: product.id, quantity: 2 }]);
    const orderId = await placed(who);

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
    expect(order.status).toBe("pending_payment");
    expect(order.payments).toMatchObject([{ provider: "request", status: "created" }]);
    expect((await readCart(who.owner, customer, shipping)).lines).toHaveLength(0);
  });
});

describe("completePayment", () => {
  it("success: paid, stock down, ordered products leave the cart, confirmation sent", async () => {
    const ordered = await makeProduct(db, { stock: 10 });
    const who = await shopper([{ productId: ordered.id, quantity: 4 }]);
    const orderId = await placed(who);
    // Added after placing: stays in the cart.
    const later = await makeProduct(db);
    await addToCart(who.owner, later.id, 1);

    expect(await succeed(orderId)).toEqual({ orderId, status: "paid", type: "store", changed: true });
    expect(await stockOf(db, ordered.id)).toBe(6);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
    expect(order.status).toBe("paid");
    expect(order.paidAt).toBeInstanceOf(Date);
    expect(order.payments[0]).toMatchObject({ status: "succeeded", completedAt: expect.any(Date) });
    expect((await readCart(who.owner, customer, shipping)).lines.map((l) => l.productId)).toEqual([later.id]);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      channel: "email",
      to: `${who.userId}@example.test`,
      subject: `Order ${order.number} confirmed`,
    });
  });

  it("success is applied once: a replay or a double click changes nothing", async () => {
    const product = await makeProduct(db, { stock: 10 });
    const who = await shopper([{ productId: product.id, quantity: 3 }]);
    const orderId = await placed(who);
    const { reference } = await livePayment(orderId);
    const verified = { reference, outcome: "succeeded" as const };

    const both = await Promise.all([completePayment(verified), completePayment(verified)]);
    expect(both.map((r) => r?.changed).sort()).toEqual([false, true]);
    expect(await completePayment(verified)).toEqual({ orderId, status: "paid", type: "store", changed: false });
    // A late "failure" for the same attempt doesn't undo it.
    expect(await completePayment({ reference, outcome: "failed" })).toEqual({
      orderId,
      status: "paid",
      type: "store",
      changed: false,
    });
    expect(await stockOf(db, product.id)).toBe(7);
    expect(sent).toHaveLength(1);
  });

  it("failure: payment_failed, with stock and cart unchanged, applied once", async () => {
    const product = await makeProduct(db, { stock: 10 });
    const who = await shopper([{ productId: product.id, quantity: 2 }]);
    const orderId = await placed(who);
    const { reference } = await livePayment(orderId);

    expect(await decline(orderId)).toEqual({ orderId, status: "payment_failed", type: "store", changed: true });
    expect(await completePayment({ reference, outcome: "failed" })).toMatchObject({ changed: false });
    // A success arriving for the failed attempt is ignored.
    expect(await completePayment({ reference, outcome: "succeeded" })).toEqual({
      orderId,
      status: "payment_failed",
      type: "store",
      changed: false,
    });
    expect(await stockOf(db, product.id)).toBe(10);
    expect((await readCart(who.owner, customer, shipping)).lines[0]?.quantity).toBe(2);
    expect(await db.payment.findUniqueOrThrow({ where: { reference } })).toMatchObject({
      status: "failed",
      failureReason: "declined",
    });
    expect(sent).toHaveLength(0);
  });

  it("failure then retry: a new attempt on the same order, which can then succeed", async () => {
    const product = await makeProduct(db, { stock: 10 });
    const who = await shopper([{ productId: product.id, quantity: 1 }]);
    const orderId = await placed(who);
    await decline(orderId);

    const stranger = await makeUser(db);
    expect(await retryPayment(stranger, orderId)).toBeNull();
    const second = await retryPayment(who.userId, orderId);
    expect(second).toMatchObject({ attempt: 2 });
    // Retrying again while attempt 2 is open returns the same attempt.
    expect(await retryPayment(who.userId, orderId)).toEqual(second);
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("pending_payment");

    expect(await succeed(orderId)).toMatchObject({ status: "paid", changed: true });
    const payments = await db.payment.findMany({ where: { orderId }, orderBy: { attempt: "asc" } });
    expect(payments.map((p) => [p.attempt, p.status])).toEqual([
      [1, "failed"],
      [2, "succeeded"],
    ]);
    expect(await stockOf(db, product.id)).toBe(9);
    // A paid order can't be retried.
    expect(await retryPayment(who.userId, orderId)).toBeNull();
  });

  it("records a failure, taking nothing, when stock ran out before the payment finished", async () => {
    const scarce = await makeProduct(db, { stock: 3 });
    const plenty = await makeProduct(db, { stock: 10 });
    const first = await shopper([
      { productId: plenty.id, quantity: 1 },
      { productId: scarce.id, quantity: 2 },
    ]);
    const second = await shopper([{ productId: scarce.id, quantity: 2 }]);
    const firstOrder = await placed(first);
    // While the first order holds its units the second can't be placed.
    expect(await place(second)).toEqual({ ok: false, error: "cart_changed" });
    // The first customer's hold lapses (they were slow to pay); the second
    // order is placed and paid, then the first payment arrives too late.
    await db.stockReservation.updateMany({
      where: { refType: "order", refId: firstOrder },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const secondOrder = await placed(second);

    expect(await succeed(secondOrder)).toMatchObject({ status: "paid" });
    expect(await succeed(firstOrder)).toEqual({
      orderId: firstOrder,
      status: "payment_failed",
      type: "store",
      changed: true,
    });
    // The whole order rolled back: neither product lost stock for it.
    expect(await stockOf(db, scarce.id)).toBe(1);
    expect(await stockOf(db, plenty.id)).toBe(10);
    expect((await db.payment.findFirstOrThrow({ where: { orderId: firstOrder } })).failureReason).toBe(
      "out_of_stock",
    );
    expect((await readCart(first.owner, customer, shipping)).lines).toHaveLength(2);
  });

  it("only applies results for the owner's orders when an owner is given", async () => {
    const product = await makeProduct(db);
    const who = await shopper([{ productId: product.id, quantity: 1 }]);
    const orderId = await placed(who);
    const stranger = await makeUser(db);
    expect(await succeed(orderId, stranger)).toBeNull();
    expect(await completePayment({ reference: "test_unknown", outcome: "succeeded" })).toBeNull();
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("pending_payment");
  });
});

describe("startPaymentAttempt and readOrderForUser", () => {
  it("reuses the open attempt and opens none for a paid order", async () => {
    const product = await makeProduct(db);
    const who = await shopper([{ productId: product.id, quantity: 1 }]);
    const orderId = await placed(who);
    const open = await startPaymentAttempt(orderId);
    expect(open).toMatchObject({ attempt: 1 });
    expect(await startPaymentAttempt(orderId)).toEqual(open);
    await succeed(orderId);
    expect(await startPaymentAttempt(orderId)).toBeNull();
  });

  it("shows an order only to its owner, with GST by rate", async () => {
    const five = await makeProduct(db, { mrpPaise: 10_500, gstRate: 5 });
    const twelve = await makeProduct(db, { mrpPaise: 11_200, gstRate: 12 });
    const who = await shopper([
      { productId: five.id, quantity: 2 },
      { productId: twelve.id, quantity: 1 },
    ]);
    const orderId = await placed(who);
    const view = await readOrderForUser(who.userId, orderId);
    expect(view?.gst).toEqual([
      { rate: 5, taxablePaise: 20_000, taxPaise: 1_000 },
      { rate: 12, taxablePaise: 10_000, taxPaise: 1_200 },
    ]);
    expect(view?.payment).toMatchObject({ attempt: 1, status: "created", provider: "test" });
    expect(await readOrderForUser(await makeUser(db), orderId)).toBeNull();
    expect(await readOrderForUser(who.userId, "not-an-id")).toBeNull();
  });
});
