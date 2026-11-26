import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addToCart } from "@/server/cart/cart";
import { createAddress, parseAddress } from "@/server/checkout/addresses";
import { placeOrder } from "@/server/checkout/orders";
import { getSetting } from "@/server/content/settings";
import { db } from "@/server/db";
import type { Message } from "@/server/notify";
import type { PricingViewer } from "@/server/pricing/rules";
import { seedDatabase } from "@/server/seed";
import { captureMessages, lastOtp, wrongCode } from "../../../tests/setup/auth";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin } from "../../../tests/setup/orders";
import { makeProduct, makeUser, stockOf, validAddress } from "../../../tests/setup/shop";
import {
  cancelAssistedOrder,
  createAssistedOrder,
  findCustomers,
  listAssistedOrders,
  listOpenPreparedOrders,
  placeAssistedOrderByStaff,
  readAssistedOrderForAdmin,
  readPreparedOrderForCustomer,
  resendAssistedOrderLink,
  sendAssistedOrderCode,
} from "./assisted-orders";

// Orders our staff prepare for customers: saving one sends the link, the
// customer places it from the link like a checkout, or staff place it on a
// call with the code the customer reads back.

const customerViewer: PricingViewer = { kind: "customer", professional: false, bulk: false };

/** The delivery and discount settings the prepared order is priced with. */
async function pricing() {
  const [shipping, discount] = await Promise.all([getSetting("checkout.shipping"), getSetting("pricing.discount")]);
  return { shipping, discountPercent: discount.percent };
}

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
  vi.useRealTimers();
});

afterAll(async () => {
  await db.$disconnect();
});

let phoneCounter = 0;

/** A customer with a mobile number, a real email and one saved address. */
async function customer() {
  phoneCounter += 1;
  const phoneNumber = `+9198${String(Date.now() % 100_000_000).padStart(8, "0").slice(0, 6)}${String(phoneCounter).padStart(2, "0")}`;
  const userId = await makeUser(db, { phoneNumber });
  const parsed = parseAddress(validAddress);
  if (!parsed.success) throw new Error("fixture should be valid");
  const address = await createAddress(userId, parsed.data);
  if (!address.ok) throw new Error("address not created");
  return { userId, phoneNumber, addressId: address.id };
}

async function prepared(staffId: string, userId: string, items: { productId: number; quantity: number }[], note = "") {
  const result = await createAssistedOrder(staffId, { userId, note, items });
  if (!result.ok) throw new Error(`not prepared: ${result.error}`);
  return result.id;
}

async function totalOf(id: string) {
  const detail = await readAssistedOrderForAdmin(id);
  if (!detail) throw new Error("no prepared order");
  return detail.priced.totals.totalPaise;
}

describe("createAssistedOrder", () => {
  it("saves the items, logs it and sends the link by SMS, email and the bell", async () => {
    const staff = await makeAdmin(db);
    const buyer = await customer();
    const a = await makeProduct(db, { mrpPaise: 32_000 });
    const b = await makeProduct(db, { mrpPaise: 10_000 });
    const result = await createAssistedOrder(staff, {
      userId: buyer.userId,
      note: "  As discussed on the phone.  ",
      // The same product twice becomes one line.
      items: [
        { productId: a.id, quantity: 1 },
        { productId: b.id, quantity: 3 },
        { productId: a.id, quantity: 1 },
      ],
    });
    // The SMS goes out, but isn't counted until an SMS provider is connected.
    expect(result).toMatchObject({ ok: true, sent: { sms: false, email: true } });
    if (!result.ok) return;
    expect(result.id).toMatch(/^[A-Za-z0-9_-]{24}$/);

    const row = await db.assistedOrder.findUniqueOrThrow({
      where: { id: result.id },
      include: { items: { orderBy: { productId: "asc" } } },
    });
    expect(row).toMatchObject({ userId: buyer.userId, createdById: staff, status: "open", note: "As discussed on the phone." });
    expect(row.items.map((item) => [item.productId, item.quantity])).toEqual([
      [a.id, 2],
      [b.id, 3],
    ]);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeGreaterThan(6.9 * 86_400_000);

    const link = `http://localhost:3000/orders/prepared/${result.id}`;
    const sms = sent.find((message) => message.channel === "sms");
    expect(sms).toMatchObject({ to: buyer.phoneNumber });
    expect(sms?.text).toContain(link);
    const email = sent.find((message) => message.channel === "email");
    expect(email?.channel === "email" && email.text).toContain(link);
    expect(email?.channel === "email" && email.text).toContain("As discussed on the phone.");

    const bell = await db.notification.findFirstOrThrow({ where: { userId: buyer.userId } });
    expect(bell).toMatchObject({ kind: "order", href: `/orders/prepared/${result.id}` });
    const log = await db.adminLog.findFirstOrThrow({ where: { resource: "AssistedOrder", resourceId: result.id } });
    expect(log).toMatchObject({ userId: staff, action: "assisted.create" });
  });

  it("refuses staff accounts, unknown customers, products off sale and quantities under the minimum", async () => {
    const staff = await makeAdmin(db);
    const buyer = await customer();
    const product = await makeProduct(db, { moq: 5 });
    const hidden = await makeProduct(db, { active: false });

    expect(await createAssistedOrder(staff, { userId: staff, note: "", items: [{ productId: product.id, quantity: 5 }] })).toEqual({
      ok: false,
      error: "admin",
    });
    expect(await createAssistedOrder(staff, { userId: "nobody", note: "", items: [{ productId: product.id, quantity: 5 }] })).toEqual({
      ok: false,
      error: "customer",
    });
    expect(await createAssistedOrder(staff, { userId: buyer.userId, note: "", items: [] })).toEqual({
      ok: false,
      error: "items",
    });
    expect(
      await createAssistedOrder(staff, { userId: buyer.userId, note: "", items: [{ productId: hidden.id, quantity: 1 }] }),
    ).toEqual({ ok: false, error: "product" });
    expect(
      await createAssistedOrder(staff, { userId: buyer.userId, note: "", items: [{ productId: product.id, quantity: 4 }] }),
    ).toMatchObject({ ok: false, error: "quantity", min: 5 });
    expect(await db.assistedOrder.count()).toBe(0);
    expect(sent).toEqual([]);
  });
});

describe("findCustomers", () => {
  it("matches customers by mobile digits, name or email, never staff, from 3 characters", async () => {
    const buyer = await customer();
    const staff = await makeAdmin(db);
    const national = buyer.phoneNumber.slice(3);
    const spaced = `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
    expect((await findCustomers(spaced)).map((match) => match.id)).toEqual([buyer.userId]);
    expect((await findCustomers(`0${national}`)).map((match) => match.id)).toEqual([buyer.userId]);
    expect((await findCustomers(buyer.userId)).map((match) => match.id)).toEqual([buyer.userId]);
    expect((await findCustomers(staff)).map((match) => match.id)).toEqual([]);
    expect(await findCustomers("98")).toEqual([]);
  });
});

describe("placing from the link", () => {
  it("orders the prepared items, not the cart, and can be placed only once", async () => {
    const staff = await makeAdmin(db);
    const buyer = await customer();
    const product = await makeProduct(db, { mrpPaise: 32_000, stock: 10 });
    const inCart = await makeProduct(db, { mrpPaise: 5_000 });
    await addToCart({ kind: "user", userId: buyer.userId }, inCart.id, 1);
    const id = await prepared(staff, buyer.userId, [{ productId: product.id, quantity: 2 }]);
    const total = await totalOf(id);

    const input = {
      userId: buyer.userId,
      viewer: customerViewer,
      addressId: buyer.addressId,
      checkoutKey: randomUUID(),
      expectedTotalPaise: total,
      ...(await pricing()),
      assisted: { id, placedBy: "customer" as const },
    };
    const result = await placeOrder(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { items: true } });
    expect(order.items.map((item) => [item.productId, item.quantity])).toEqual([[product.id, 2]]);
    expect(order.totalPaise).toBe(total);
    expect(await db.assistedOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "placed",
      placedBy: "customer",
      orderId: result.orderId,
    });
    // The cart is left as it was.
    expect(await db.cartItem.count({ where: { cart: { userId: buyer.userId } } })).toBe(1);
    // A second go (another tab, or staff at the same moment) is refused.
    expect(await placeOrder({ ...input, checkoutKey: randomUUID() })).toEqual({ ok: false, error: "closed" });
    expect(await stockOf(db, product.id)).toBe(10);
  });

  it("is refused for another account, after cancelling and after the link expires", async () => {
    const staff = await makeAdmin(db);
    const buyer = await customer();
    const stranger = await customer();
    const product = await makeProduct(db);
    const id = await prepared(staff, buyer.userId, [{ productId: product.id, quantity: 1 }]);
    const total = await totalOf(id);
    const settings = await pricing();
    const place = (who: { userId: string; addressId: number }) =>
      placeOrder({
        userId: who.userId,
        viewer: customerViewer,
        addressId: who.addressId,
        checkoutKey: randomUUID(),
        expectedTotalPaise: total,
        ...settings,
        assisted: { id, placedBy: "customer" },
      });

    expect(await place(stranger)).toEqual({ ok: false, error: "closed" });
    expect(await readPreparedOrderForCustomer(stranger.userId, customerViewer, id)).toEqual({ mine: false });

    await db.assistedOrder.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await place(buyer)).toEqual({ ok: false, error: "closed" });
    expect(await readPreparedOrderForCustomer(buyer.userId, customerViewer, id)).toMatchObject({ status: "expired" });
    expect(await listOpenPreparedOrders(buyer.userId, customerViewer)).toEqual([]);

    await db.assistedOrder.update({ where: { id }, data: { expiresAt: new Date(Date.now() + 86_400_000) } });
    expect(await listOpenPreparedOrders(buyer.userId, customerViewer)).toMatchObject([{ id, itemCount: 1, totalPaise: total }]);
    expect(await cancelAssistedOrder(staff, id)).toBe(true);
    expect(await cancelAssistedOrder(staff, id)).toBe(false);
    expect(await place(buyer)).toEqual({ ok: false, error: "closed" });
    expect(await resendAssistedOrderLink(id)).toEqual({ ok: false, error: "closed" });
    expect((await listAssistedOrders({ page: 1, status: "cancelled" })).rows.map((row) => row.id)).toEqual([id]);
  });
});

describe("confirming on a call", () => {
  it("sends a code, refuses wrong ones, and places the order with the right one", async () => {
    const staff = await makeAdmin(db);
    const buyer = await customer();
    const product = await makeProduct(db, { mrpPaise: 32_000 });
    const id = await prepared(staff, buyer.userId, [{ productId: product.id, quantity: 1 }]);
    const total = await totalOf(id);
    const place = (code: string) =>
      placeAssistedOrderByStaff(staff, { id, code, addressId: buyer.addressId, expectedTotalPaise: total });

    expect(await place("123456")).toEqual({ ok: false, error: "no_code" });
    expect(await sendAssistedOrderCode(staff, id)).toMatchObject({ ok: true, sent: { sms: false, email: true } });
    const code = lastOtp(sent, buyer.phoneNumber);
    expect(code).toMatch(/^\d{6}$/);
    // The SMS names the total, so the customer knows what they confirm.
    expect(sent.findLast((message) => message.channel === "sms")?.text).toContain("₹");
    // Only a hash is stored.
    const row = await db.assistedOrder.findUniqueOrThrow({ where: { id } });
    expect(row.codeHash).not.toContain(code);

    expect(await place(wrongCode(code))).toEqual({ ok: false, error: "wrong_code", triesLeft: 4 });
    const result = await place(code);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await db.order.findUniqueOrThrow({ where: { id: result.orderId } })).toMatchObject({
      userId: buyer.userId,
      status: "pending_payment",
      totalPaise: total,
    });
    expect(await db.assistedOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "placed",
      placedBy: "staff",
      orderId: result.orderId,
      codeHash: null,
    });
    expect(await db.adminLog.count({ where: { resourceId: id, action: "assisted.place", userId: staff } })).toBe(1);
    // The code can't be used again.
    expect(await place(code)).toEqual({ ok: false, error: "closed" });
  });

  it("locks the code after 5 wrong tries, lets it expire, and limits how often codes are sent", async () => {
    const staff = await makeAdmin(db);
    const buyer = await customer();
    const product = await makeProduct(db);
    const id = await prepared(staff, buyer.userId, [{ productId: product.id, quantity: 1 }]);
    const total = await totalOf(id);
    const place = (code: string) =>
      placeAssistedOrderByStaff(staff, { id, code, addressId: buyer.addressId, expectedTotalPaise: total });

    await sendAssistedOrderCode(staff, id);
    const code = lastOtp(sent, buyer.phoneNumber);
    for (let left = 4; left >= 0; left -= 1) {
      expect(await place(wrongCode(code))).toEqual({ ok: false, error: "wrong_code", triesLeft: left });
    }
    expect(await place(code)).toEqual({ ok: false, error: "too_many_tries" });

    // A new code starts again.
    await sendAssistedOrderCode(staff, id);
    const fresh = lastOtp(sent, buyer.phoneNumber);
    await db.assistedOrder.update({ where: { id }, data: { codeExpiresAt: new Date(Date.now() - 1000) } });
    expect(await place(fresh)).toEqual({ ok: false, error: "code_expired" });

    // Three codes per 10 minutes.
    expect(await sendAssistedOrderCode(staff, id)).toMatchObject({ ok: true });
    expect(await sendAssistedOrderCode(staff, id)).toEqual({ ok: false, error: "rate_limited" });
  });

  it("only places to the customer's own address", async () => {
    const staff = await makeAdmin(db);
    const buyer = await customer();
    const stranger = await customer();
    const product = await makeProduct(db);
    const id = await prepared(staff, buyer.userId, [{ productId: product.id, quantity: 1 }]);
    const total = await totalOf(id);
    await sendAssistedOrderCode(staff, id);
    const code = lastOtp(sent, buyer.phoneNumber);
    expect(
      await placeAssistedOrderByStaff(staff, { id, code, addressId: stranger.addressId, expectedTotalPaise: total }),
    ).toEqual({ ok: false, error: "address" });
    expect(await db.assistedOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "open" });
  });
});

describe("customers we can only reach by SMS", () => {
  it("get no code while SMS isn't set up, but the link still shows on their account", async () => {
    const staff = await makeAdmin(db);
    const phoneOnly = await makeUser(db, { email: "919811112222@phone.saatvikvaidya.invalid", phoneNumber: "+919811112222" });
    const product = await makeProduct(db);
    const result = await createAssistedOrder(staff, { userId: phoneOnly, note: "", items: [{ productId: product.id, quantity: 1 }] });
    expect(result).toMatchObject({ ok: true, sent: { sms: false, email: false } });
    if (!result.ok) return;
    expect(await db.notification.count({ where: { userId: phoneOnly } })).toBe(1);
    expect(await readAssistedOrderForAdmin(result.id)).toMatchObject({ canReach: false });
    expect(await sendAssistedOrderCode(staff, result.id)).toEqual({ ok: false, error: "no_contact" });
  });
});
