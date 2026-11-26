import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import type { Message } from "@/server/notify";
import { seedDatabase } from "@/server/seed";
import { captureMessages } from "../../../tests/setup/auth";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin, makeOrder } from "../../../tests/setup/orders";
import { getShippingProvider, testShippingAllowed } from "./index";
import { createShipment, recordShipmentEvent, simulateShipmentStep } from "./shipments";

// Test shipping (P1.5): a fake courier and AWB, each step recorded once,
// the order's status following the shipment, and a message per step.

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
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await db.$disconnect();
});

const orderStatus = async (orderId: string) =>
  (await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } })).status;

const shipmentOf = (orderId: string) =>
  db.shipment.findUniqueOrThrow({
    where: { orderId },
    include: { events: { orderBy: { id: "asc" } } },
  });

describe("test shipping provider", () => {
  it("refuses production unless it's the local e2e build", () => {
    expect(testShippingAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(testShippingAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(
      testShippingAllowed({
        NODE_ENV: "production",
        TEST_SHIPPING_IN_LOCAL_BUILD: "true",
        BETTER_AUTH_URL: "https://saatvikvaidya.com",
      }),
    ).toBe(false);
    expect(
      testShippingAllowed({
        NODE_ENV: "production",
        TEST_SHIPPING_IN_LOCAL_BUILD: "true",
        BETTER_AUTH_URL: "http://localhost:3100",
      }),
    ).toBe(true);
  });

  it("rejects unknown providers and bad events", async () => {
    expect(() => getShippingProvider({ SHIPPING_PROVIDER: "shiprocket" })).toThrow(/Unknown/);
    await expect(getShippingProvider().verifyEvent({ awb: "X", status: "teleported" })).rejects.toThrow();
  });

  it("gives way to the manual provider on a server", async () => {
    expect(getShippingProvider({ SHIPPING_PROVIDER: "test", NODE_ENV: "production" }).name).toBe("manual");
    expect(getShippingProvider({ NODE_ENV: "production" }).name).toBe("manual");
    expect(getShippingProvider({ NODE_ENV: "development" }).name).toBe("test");
    expect(getShippingProvider({ SHIPPING_PROVIDER: "manual", NODE_ENV: "development" }).name).toBe("manual");

    const order = await makeOrder(db);
    vi.stubEnv("NODE_ENV", "production");
    expect(await createShipment(adminId, order.orderId)).toEqual({ ok: true, changed: true, status: "created" });
    const shipment = await shipmentOf(order.orderId);
    expect(shipment.provider).toBe("manual");
    expect(shipment.courierName).not.toMatch(/simulated/);
  });
});

describe("manual shipping", () => {
  beforeEach(() => {
    vi.stubEnv("SHIPPING_PROVIDER", "manual");
  });

  it("records the courier and tracking number the admin typed, and steps with no made-up places", async () => {
    const order = await makeOrder(db);
    const created = await createShipment(adminId, order.orderId, {
      courierName: "DTDC",
      trackingNumber: `D${Date.now()}`,
    });
    expect(created).toEqual({ ok: true, changed: true, status: "created" });
    const shipment = await shipmentOf(order.orderId);
    expect(shipment).toMatchObject({ provider: "manual", courierName: "DTDC" });
    expect(shipment.awb).toMatch(/^D\d+$/);

    expect(await simulateShipmentStep(adminId, order.orderId, "next", "created")).toEqual({
      ok: true,
      changed: true,
      status: "packed",
    });
    const events = (await shipmentOf(order.orderId)).events;
    expect(events.map((event) => [event.status, event.location])).toEqual([
      ["created", null],
      ["packed", null],
    ]);
    expect(await orderStatus(order.orderId)).toBe("processing");
  });

  it("falls back to our name and the order number when nothing was typed", async () => {
    const order = await makeOrder(db);
    await createShipment(adminId, order.orderId);
    const shipment = await shipmentOf(order.orderId);
    expect(shipment.courierName).toBe("Saatvik Vaidya");
    expect(shipment.awb).toBe(order.number);
  });

  it("refuses a tracking number already on another order", async () => {
    const first = await makeOrder(db);
    const second = await makeOrder(db);
    const trackingNumber = `T${Date.now()}`;
    await createShipment(adminId, first.orderId, { trackingNumber });
    expect(await createShipment(adminId, second.orderId, { trackingNumber })).toEqual({
      ok: false,
      error: "awb_taken",
    });
    expect(await db.shipment.count({ where: { orderId: second.orderId } })).toBe(0);
    expect(await orderStatus(second.orderId)).toBe("paid");
  });
});

describe("createShipment", () => {
  it("books a paid order with a fake courier and AWB, and tells the buyer in the bell", async () => {
    const order = await makeOrder(db);
    sent.length = 0;
    const result = await createShipment(adminId, order.orderId);
    expect(result).toEqual({ ok: true, changed: true, status: "created" });

    const shipment = await shipmentOf(order.orderId);
    expect(shipment.provider).toBe("test");
    expect(shipment.courierName).toMatch(/simulated/);
    expect(shipment.awb).toMatch(/^[A-Z]{2}\d{12}$/);
    expect(shipment.events.map((event) => event.status)).toEqual(["created"]);
    expect(shipment.events[0]?.actorId).toBe(adminId);
    expect(await orderStatus(order.orderId)).toBe("processing");
    // "Preparing your order" only shows in the bell; the first email is "Shipped".
    expect(sent).toHaveLength(0);
    expect(await db.notification.count({ where: { userId: order.userId, title: { contains: order.number } } })).toBeGreaterThan(0);
    expect(await db.adminLog.count({ where: { action: "shipment.create", resourceId: order.orderId } })).toBe(1);
  });

  it("refuses unpaid orders, unknown ids and a second shipment", async () => {
    const unpaid = await makeOrder(db, { pay: false });
    expect(await createShipment(adminId, unpaid.orderId)).toEqual({ ok: false, error: "not_paid" });
    expect(await createShipment(adminId, "x".repeat(22))).toEqual({ ok: false, error: "not_found" });
    expect(await createShipment(adminId, "not-an-id")).toEqual({ ok: false, error: "not_found" });

    const paid = await makeOrder(db);
    await createShipment(adminId, paid.orderId);
    expect(await createShipment(adminId, paid.orderId)).toEqual({ ok: false, error: "exists" });
  });

  it("creates one shipment when clicked twice at once", async () => {
    const order = await makeOrder(db);
    const results = await Promise.all([
      createShipment(adminId, order.orderId),
      createShipment(adminId, order.orderId),
    ]);
    expect(results.filter((result) => result.ok && result.changed)).toHaveLength(1);
    expect(await db.shipment.count({ where: { orderId: order.orderId } })).toBe(1);
    expect(await db.shipmentEvent.count()).toBe(1);
  });
});

describe("moving a shipment on", () => {
  it("goes through every step, moving the order's status and emailing the steps that matter", async () => {
    const order = await makeOrder(db);
    await createShipment(adminId, order.orderId);
    sent.length = 0;

    const expected = [
      ["created", "packed", "processing"],
      ["packed", "shipped", "shipped"],
      ["shipped", "in_transit", "shipped"],
      ["in_transit", "out_for_delivery", "shipped"],
      ["out_for_delivery", "delivered", "delivered"],
    ] as const;
    for (const [from, to, status] of expected) {
      const result = await simulateShipmentStep(adminId, order.orderId, "next", from);
      expect(result).toEqual({ ok: true, changed: true, status: to });
      expect(await orderStatus(order.orderId)).toBe(status);
    }
    const shipment = await shipmentOf(order.orderId);
    expect(shipment.events.map((event) => event.status)).toEqual([
      "created",
      "packed",
      "shipped",
      "in_transit",
      "out_for_delivery",
      "delivered",
    ]);
    // Out for delivery and delivered happen in the buyer's city.
    expect(shipment.events.at(-1)?.location).toBe("Pune");
    // Shipped, out for delivery and delivered, like a big shop; packed and in transit only show in the bell.
    expect(sent.map((message) => message.channel === "email" && message.subject)).toEqual([
      `Shipped: your order ${order.number} is on its way`,
      `Out for delivery: your order ${order.number} arrives today`,
      `Delivered: your order ${order.number}`,
    ]);
    expect(sent[0]?.channel === "email" && sent[0].text).toContain(shipment.awb);

    // Nothing follows delivery.
    expect(await simulateShipmentStep(adminId, order.orderId, "next", "delivered")).toEqual({
      ok: false,
      error: "not_allowed",
    });
    expect(await simulateShipmentStep(adminId, order.orderId, "returned", "delivered")).toEqual({
      ok: false,
      error: "not_allowed",
    });
  });

  it("applies a double click once", async () => {
    const order = await makeOrder(db);
    await createShipment(adminId, order.orderId);
    await simulateShipmentStep(adminId, order.orderId, "next", "created");
    sent.length = 0;
    const results = await Promise.all([
      simulateShipmentStep(adminId, order.orderId, "next", "packed"),
      simulateShipmentStep(adminId, order.orderId, "next", "packed"),
    ]);
    expect(results.filter((result) => result.ok && result.changed)).toHaveLength(1);
    expect((await shipmentOf(order.orderId)).status).toBe("shipped");
    expect(await db.shipmentEvent.count({ where: { status: "shipped" } })).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it("ignores a replayed provider event", async () => {
    const order = await makeOrder(db);
    await createShipment(adminId, order.orderId);
    const { awb } = await shipmentOf(order.orderId);
    expect(await recordShipmentEvent({ awb, status: "packed" })).toMatchObject({ changed: true });
    expect(await recordShipmentEvent({ awb, status: "packed" })).toMatchObject({ changed: false });
    // A step that skips ahead isn't allowed.
    expect(await recordShipmentEvent({ awb, status: "delivered" })).toEqual({ ok: false, error: "not_allowed" });
    expect(await recordShipmentEvent({ awb, status: "cancelled" })).toEqual({ ok: false, error: "not_allowed" });
    expect(await recordShipmentEvent({ awb: "NOPE", status: "packed" })).toEqual({ ok: false, error: "not_found" });
    expect(await db.shipmentEvent.count({ where: { status: "packed" } })).toBe(1);
  });

  it("handles a failed delivery, a second attempt and a return", async () => {
    const order = await makeOrder(db);
    await createShipment(adminId, order.orderId);
    for (const from of ["created", "packed", "shipped", "in_transit"] as const) {
      await simulateShipmentStep(adminId, order.orderId, "next", from);
    }
    // Undelivered and returned only where they make sense.
    expect(await simulateShipmentStep(adminId, order.orderId, "returned", "out_for_delivery")).toEqual({
      ok: false,
      error: "not_allowed",
    });
    expect(await simulateShipmentStep(adminId, order.orderId, "undelivered", "out_for_delivery")).toMatchObject({
      changed: true,
      status: "undelivered",
    });
    expect(await orderStatus(order.orderId)).toBe("shipped");
    // "Next" after a failed attempt sends it out again.
    expect(await simulateShipmentStep(adminId, order.orderId, "next", "undelivered")).toMatchObject({
      status: "out_for_delivery",
    });
    await simulateShipmentStep(adminId, order.orderId, "undelivered", "out_for_delivery");
    expect(await simulateShipmentStep(adminId, order.orderId, "returned", "undelivered")).toMatchObject({
      changed: true,
      status: "returned",
    });
    expect(await orderStatus(order.orderId)).toBe("returned");
    expect(sent.at(-1)).toMatchObject({ subject: `Returned to us: order ${order.number}` });
  });

  it("doesn't move a cancelled order's status", async () => {
    const order = await makeOrder(db);
    await createShipment(adminId, order.orderId);
    const { awb } = await shipmentOf(order.orderId);
    await db.order.update({ where: { id: order.orderId }, data: { status: "cancelled" } });
    await recordShipmentEvent({ awb, status: "packed" });
    expect(await orderStatus(order.orderId)).toBe("cancelled");
  });
});
