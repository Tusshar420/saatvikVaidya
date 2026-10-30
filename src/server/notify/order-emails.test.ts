import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { settingDefaults } from "@/content/settings";
import type { ShipmentStatusKey } from "@/lib/shipping";
import { markOrderPaid } from "@/server/admin/order-payment";
import { addToCart, readCart, type CartOwner } from "@/server/cart/cart";
import { createAddress, parseAddress } from "@/server/checkout/addresses";
import { placeOrder } from "@/server/checkout/orders";
import { db } from "@/server/db";
import type { Message } from "@/server/notify";
import { seedDatabase } from "@/server/seed";
import { createShipment, simulateShipmentStep } from "@/server/shipping/shipments";
import { captureMessages } from "../../../tests/setup/auth";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin } from "../../../tests/setup/orders";
import { makeProduct, makeUser, validAddress } from "../../../tests/setup/shop";

// The order emails end to end: placing an order (QR, bank or phone payment),
// the team's alert, the confirmation and the delivery steps.
//
// EMAIL_PREVIEW_DIR=/tmp/emails pnpm vitest run src/server/notify/order-emails.test.ts
// also saves each email as an HTML file to look at in a browser.

const shipping = { feePaise: 8_000, freeFromPaise: 99_900 };
const customer = { kind: "customer", professional: false, bulk: false } as const;
const paymentDetails = {
  ...settingDefaults["payment.manual"],
  payeeName: "Saatvik Vaidya",
  upiId: "saatvik@okaxis",
  bankName: "HDFC Bank",
  accountNumber: "123456789012",
  ifsc: "HDFC0001234",
};

let sent: Message[];

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
  await db.setting.upsert({
    where: { key: "payment.manual" },
    create: { key: "payment.manual", value: paymentDetails },
    update: { value: paymentDetails },
  });
});

beforeEach(async () => {
  await clearAuthTables(db);
  sent = captureMessages();
  vi.stubEnv("PAYMENT_PROVIDER", "manual");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await db.$disconnect();
});

function emails(): Extract<Message, { channel: "email" }>[] {
  return sent.flatMap((message) => (message.channel === "email" ? [message] : []));
}

function preview(name: string, message: Extract<Message, { channel: "email" }> | undefined) {
  const dir = process.env.EMAIL_PREVIEW_DIR;
  if (!dir || !message?.html) return;
  mkdirSync(dir, { recursive: true });
  let html = message.html;
  for (const image of message.attachments ?? []) {
    html = html.replaceAll(`cid:${image.cid}`, `data:${image.contentType};base64,${image.content.toString("base64")}`);
  }
  writeFileSync(join(dir, `${name}.html`), html);
}

async function placeStoreOrder(options: { name?: string; quiet?: boolean } = {}) {
  const product = await makeProduct(db, { stock: 10 });
  const userId = await makeUser(db, { type: "customer", verificationStatus: "none" });
  await db.user.update({
    where: { id: userId },
    data: { ...(options.name ? { name: options.name } : {}), notifyOrderEmail: !options.quiet },
  });
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
  const order = await db.order.findUniqueOrThrow({ where: { id: placed.orderId }, include: { user: true, items: true } });
  return { orderId: order.id, number: order.number, email: order.user!.email, productName: order.items[0]!.productName };
}

async function ordersAdmin(role: "orders" | "content" = "orders") {
  const id = await makeAdmin(db);
  const admin = await db.user.update({ where: { id }, data: { adminRole: role } });
  return { id, email: admin.email };
}

describe("order placed, paying by QR code or bank transfer", () => {
  it("emails the buyer the QR code, UPI ID, bank details and the order summary", async () => {
    const order = await placeStoreOrder();
    const mail = emails().find((message) => message.to === order.email);
    preview("1-order-placed-manual", mail);
    expect(mail?.subject).toBe(`We've received your order ${order.number}`);
    expect(mail?.text).toContain("saatvik@okaxis");
    expect(mail?.text).toContain("HDFC0001234");
    expect(mail?.text).toContain("123456789012");
    expect(mail?.text).toContain(order.productName);
    expect(mail?.text).toContain(`/checkout/pay/${order.orderId}`);
    expect(mail?.html).toContain(`cid:qr-${order.number}@saatvikvaidya`);
    const qr = mail?.attachments?.find((image) => image.contentType === "image/png");
    expect(qr?.content.subarray(1, 4).toString()).toBe("PNG");
  });

  it("alerts the orders team with a link to the order, and no one else", async () => {
    const team = await ordersAdmin("orders");
    const content = await ordersAdmin("content");
    const order = await placeStoreOrder();
    const alert = emails().find((message) => message.to === team.email);
    preview("2-staff-new-order", alert);
    expect(alert?.subject).toMatch(new RegExp(`^New order ${order.number}: ₹`));
    expect(alert?.text).toContain(`/admin/orders/${order.orderId}`);
    expect(alert?.text).toContain("Mark it paid");
    expect(emails().some((message) => message.to === content.email)).toBe(false);
  });

  it("escapes the buyer's name in the HTML", async () => {
    const order = await placeStoreOrder({ name: "<b>Asha</b>" });
    const mail = emails().find((message) => message.to === order.email);
    expect(mail?.html).toContain("Namaste &lt;b&gt;Asha&lt;/b&gt;,");
    expect(mail?.html).not.toContain("<b>Asha</b>");
  });

  it("sends no buyer email when they turned order emails off, but still alerts the team", async () => {
    const team = await ordersAdmin();
    const order = await placeStoreOrder({ quiet: true });
    expect(emails().some((message) => message.to === order.email)).toBe(false);
    expect(emails().some((message) => message.to === team.email)).toBe(true);
  });
});

describe("order placed with other payment methods", () => {
  it("phone-arranged payment: says the team will call, with no QR code", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "request");
    const order = await placeStoreOrder();
    const mail = emails().find((message) => message.to === order.email);
    preview("1b-order-placed-request", mail);
    expect(mail?.subject).toBe(`We've received your order ${order.number}`);
    expect(mail?.text).toContain("Our team will call you");
    expect(mail?.text).not.toContain("saatvik@okaxis");
    expect(mail?.attachments?.some((image) => image.contentType === "image/png")).toBe(false);
  });

  it("test payments: nothing is sent when the order is placed", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "test");
    await ordersAdmin();
    await placeStoreOrder();
    expect(sent).toEqual([]);
  });
});

describe("after the order is placed", () => {
  it("confirms the payment, then emails only the delivery steps that matter", async () => {
    const order = await placeStoreOrder();
    const admin = await ordersAdmin();
    sent.length = 0;

    expect(await markOrderPaid(admin.id, order.orderId)).toEqual({ ok: true, changed: true });
    const confirmed = emails().find((message) => message.to === order.email);
    preview("3-order-confirmed", confirmed);
    expect(confirmed?.subject).toBe(`Your order ${order.number} is confirmed`);
    expect(confirmed?.text).toContain("Total paid");

    sent.length = 0;
    const shipment = await createShipment(admin.id, order.orderId);
    expect(shipment.ok).toBe(true);
    // created → packed → shipped → in transit → out for delivery → delivered
    let from: ShipmentStatusKey = "created";
    for (let step = 0; step < 5; step += 1) {
      const moved = await simulateShipmentStep(admin.id, order.orderId, "next", from);
      if (!moved.ok) throw new Error(`step refused: ${moved.error}`);
      from = moved.status;
    }
    expect(from).toBe("delivered");
    const subjects = emails().map((message) => message.subject);
    expect(subjects).toEqual([
      `Shipped: your order ${order.number} is on its way`,
      `Out for delivery: your order ${order.number} arrives today`,
      `Delivered: your order ${order.number}`,
    ]);
    preview("4-shipped", emails()[0]);
    preview("5-out-for-delivery", emails()[1]);
    preview("6-delivered", emails()[2]);
    // Every step still shows in the bell.
    expect(await db.notification.count({ where: { user: { email: order.email }, kind: "order" } })).toBe(7);
  });
});
