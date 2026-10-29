import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startPaymentAttempt } from "@/server/checkout/orders";
import { completePayment } from "@/server/checkout/payments";
import { db } from "@/server/db";
import type { Message } from "@/server/notify";
import { seedDatabase } from "@/server/seed";
import { createShipment, simulateShipmentStep } from "@/server/shipping/shipments";
import { captureMessages } from "../../../tests/setup/auth";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin, makeOrder } from "../../../tests/setup/orders";
import { stockOf } from "../../../tests/setup/shop";
import { cancelOrder, countOrdersToShip, listAdminOrders, orderFiltersSchema } from "./orders";

// Orders in the admin panel (P1.5): the list's filters and cancelling, which
// puts back stock that a payment took, exactly once.

let sent: Message[];
let adminId: string;

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
  sent = captureMessages();
  adminId = await makeAdmin(db);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

const statusOf = async (orderId: string) =>
  (await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, cancelledAt: true } }));

describe("cancelOrder", () => {
  it("puts a paid order's stock back once, even when cancelled twice at once", async () => {
    const order = await makeOrder(db, { quantity: 3 });
    expect(await stockOf(db, order.productId)).toBe(47);
    sent.length = 0;

    const results = await Promise.all([
      // Either may win, so both carry the note.
      cancelOrder(adminId, order.orderId, "Customer asked"),
      cancelOrder(adminId, order.orderId, "Customer asked"),
    ]);
    expect(results.filter((result) => result.ok && result.changed)).toHaveLength(1);
    expect(await stockOf(db, order.productId)).toBe(50);
    const after = await statusOf(order.orderId);
    expect(after.status).toBe("cancelled");
    expect(after.cancelledAt).toBeInstanceOf(Date);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ subject: `Order ${order.number} cancelled` });

    const log = await db.adminLog.findFirstOrThrow({ where: { action: "order.cancel" } });
    expect(log.resourceId).toBe(order.orderId);
    expect(log.changes).toMatchObject({ note: "Customer asked" });

    // Again later: nothing changes.
    expect(await cancelOrder(adminId, order.orderId)).toEqual({ ok: true, changed: false, restocked: false });
    expect(await stockOf(db, order.productId)).toBe(50);
  });

  it("cancels an unpaid order without touching stock, and its open attempt can't be paid", async () => {
    const order = await makeOrder(db, { pay: false });
    const payment = await startPaymentAttempt(order.orderId);
    expect(await cancelOrder(adminId, order.orderId)).toEqual({ ok: true, changed: true, restocked: false });
    expect(await stockOf(db, order.productId)).toBe(50);

    const late = await completePayment({ reference: payment!.reference, outcome: "succeeded" });
    expect(late?.status).toBe("cancelled");
    expect(await stockOf(db, order.productId)).toBe(50);
    const attempt = await db.payment.findUniqueOrThrow({ where: { reference: payment!.reference } });
    expect(attempt).toMatchObject({ status: "failed", failureReason: "cancelled" });
  });

  it("calls off a shipment that hasn't left, and refuses once it has", async () => {
    const packed = await makeOrder(db);
    await createShipment(adminId, packed.orderId);
    await simulateShipmentStep(adminId, packed.orderId, "next", "created");
    expect(await cancelOrder(adminId, packed.orderId)).toMatchObject({ ok: true, restocked: true });
    const shipment = await db.shipment.findUniqueOrThrow({
      where: { orderId: packed.orderId },
      include: { events: { orderBy: { id: "asc" } } },
    });
    expect(shipment.status).toBe("cancelled");
    expect(shipment.events.at(-1)?.status).toBe("cancelled");
    expect(await stockOf(db, packed.productId)).toBe(50);

    const shipped = await makeOrder(db);
    await createShipment(adminId, shipped.orderId);
    await simulateShipmentStep(adminId, shipped.orderId, "next", "created");
    await simulateShipmentStep(adminId, shipped.orderId, "next", "packed");
    expect(await cancelOrder(adminId, shipped.orderId)).toEqual({ ok: false, error: "not_allowed" });
    expect((await statusOf(shipped.orderId)).status).toBe("shipped");
    expect(await stockOf(db, shipped.productId)).toBe(48);

    expect(await cancelOrder(adminId, "y".repeat(22))).toEqual({ ok: false, error: "not_found" });
  });
});

describe("listAdminOrders", () => {
  it("filters by status, search and date, newest first", async () => {
    const first = await makeOrder(db, { address: { name: "Meera Iyer" } });
    const second = await makeOrder(db, { pay: false });
    await db.order.update({
      where: { id: first.orderId },
      data: { createdAt: new Date("2026-09-10T10:00:00+05:30") },
    });

    const all = await listAdminOrders(orderFiltersSchema.parse({}));
    expect(all.orders.map((order) => order.id)).toEqual([second.orderId, first.orderId]);
    expect(all.total).toBe(2);

    const paid = await listAdminOrders(orderFiltersSchema.parse({ status: "paid" }));
    expect(paid.orders.map((order) => order.id)).toEqual([first.orderId]);

    const byNumber = await listAdminOrders(orderFiltersSchema.parse({ q: second.number.toLowerCase() }));
    expect(byNumber.orders.map((order) => order.id)).toEqual([second.orderId]);
    const byName = await listAdminOrders(orderFiltersSchema.parse({ q: "meera" }));
    expect(byName.orders.map((order) => order.id)).toEqual([first.orderId]);

    // A phone-like query searches phones; the digits inside an order number
    // don't (both test orders share the phone 98765 43210).
    const byPhone = await listAdminOrders(orderFiltersSchema.parse({ q: "43210" }));
    expect(byPhone.total).toBe(2);
    const digitNumber = await listAdminOrders(orderFiltersSchema.parse({ q: "SV-AAA876BB" }));
    expect(digitNumber.total).toBe(0);

    const september = await listAdminOrders(orderFiltersSchema.parse({ from: "2026-09-10", to: "2026-09-10" }));
    expect(september.orders.map((order) => order.id)).toEqual([first.orderId]);

    // Bad values are dropped rather than failing the page.
    expect(orderFiltersSchema.parse({ status: "lost", from: "yesterday", page: "-3" })).toEqual({
      q: undefined,
      status: undefined,
      from: undefined,
      to: undefined,
      page: undefined,
    });
    expect(await countOrdersToShip()).toEqual({ total: 2, toShip: 1 });
  });
});
