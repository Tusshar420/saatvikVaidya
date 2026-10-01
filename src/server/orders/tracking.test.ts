import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { placeholderEmailFor } from "@/server/auth/placeholder-email";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { createShipment, simulateShipmentStep } from "@/server/shipping/shipments";
import { captureMessages } from "../../../tests/setup/auth";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin, makeOrder } from "../../../tests/setup/orders";
import { makeUser } from "../../../tests/setup/shop";
import { listOrdersForUser } from "./history";
import { readTrackingForUser, trackInputSchema, trackOrder } from "./tracking";

// Order history and tracking (P1.5): only the buyer's own orders, and the
// Track Order lookup by order number plus the phone or email on the order,
// rate-limited and never saying whether an order exists.

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
  captureMessages();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

let ipCounter = 0;
const freshIp = () => `10.20.0.${(ipCounter += 1)}`;
const input = (number: string, contact: string) => trackInputSchema.parse({ number, contact });

describe("trackInputSchema", () => {
  it("tidies order numbers and reads phones and emails", () => {
    expect(trackInputSchema.parse({ number: " sv-7k2q 9f4m ", contact: "+91 98765-43210" })).toEqual({
      number: "SV-7K2Q9F4M",
      contact: { kind: "phone", value: "+919876543210" },
    });
    expect(trackInputSchema.parse({ number: "7K2Q9F4M", contact: " Asha@Example.COM " })).toEqual({
      number: "SV-7K2Q9F4M",
      contact: { kind: "email", value: "asha@example.com" },
    });
    expect(trackInputSchema.safeParse({ number: "SV-123", contact: "9876543210" }).success).toBe(false);
    expect(trackInputSchema.safeParse({ number: "SV-7K2Q9F4M", contact: "12345" }).success).toBe(false);
    expect(trackInputSchema.safeParse({ number: "SV-7K2Q9F4M", contact: "not@mail" }).success).toBe(false);
  });
});

describe("trackOrder", () => {
  it("finds an order by the delivery phone, the account phone or the account email", async () => {
    const order = await makeOrder(db, { email: "asha@example.test", phoneNumber: "+919811122233" });
    for (const contact of ["98765 43210", "9811122233", "ASHA@example.test"]) {
      const result = await trackOrder(input(order.number, contact), freshIp());
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.tracking.number).toBe(order.number);
    }
  });

  it("gives the same answer for a wrong contact and an unknown order", async () => {
    const order = await makeOrder(db);
    const wrongContact = await trackOrder(input(order.number, "9000000000"), freshIp());
    const unknown = await trackOrder(input("SV-00000000", "9876543210"), freshIp());
    expect(wrongContact).toEqual({ ok: false, error: "not_found" });
    expect(unknown).toEqual(wrongContact);
  });

  it("never matches a phone-only account's placeholder email", async () => {
    const userId = await makeUser(db, {
      phoneNumber: "+919822233344",
      email: placeholderEmailFor("+919822233344"),
    });
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const order = await makeOrder(db, { userId });
    const result = await trackOrder(input(order.number, user.email), freshIp());
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("limits lookups per IP and per order number", async () => {
    const order = await makeOrder(db);
    const ip = freshIp();
    for (let i = 0; i < 10; i += 1) {
      expect((await trackOrder(input(order.number, "9000000000"), ip)).ok).toBe(false);
    }
    expect(await trackOrder(input(order.number, "9876543210"), ip)).toEqual({ ok: false, error: "rate_limited" });
    // From another IP the number itself is used up too.
    expect(await trackOrder(input(order.number, "9876543210"), freshIp())).toEqual({
      ok: false,
      error: "rate_limited",
    });
    // Another order from a fresh IP is fine.
    const other = await makeOrder(db);
    expect((await trackOrder(input(other.number, "9876543210"), freshIp())).ok).toBe(true);
  });

  it("shows the timeline with when each step happened", async () => {
    const adminId = await makeAdmin(db);
    const order = await makeOrder(db);
    let result = await trackOrder(input(order.number, "9876543210"), freshIp());
    expect(result.ok && result.tracking.current).toBe(1);
    expect(result.ok && result.tracking.shipment).toBeNull();

    await createShipment(adminId, order.orderId);
    await simulateShipmentStep(adminId, order.orderId, "next", "created");
    await simulateShipmentStep(adminId, order.orderId, "next", "packed");
    result = await trackOrder(input(order.number, "9876543210"), freshIp());
    if (!result.ok) throw new Error("should be found");
    const { tracking } = result;
    expect(tracking.status).toBe("shipped");
    expect(tracking.current).toBe(3);
    expect(tracking.shipment).toMatchObject({ provider: "test", status: "shipped" });
    expect(tracking.steps.map((step) => [step.key, step.at !== null])).toEqual([
      ["confirmed", true],
      ["packed", true],
      ["shipped", true],
      ["in_transit", false],
      ["out_for_delivery", false],
      ["delivered", false],
    ]);
    expect(tracking.events.map((event) => event.status)).toEqual(["shipped", "packed", "created"]);
  });

  it("has no timeline for unpaid orders", async () => {
    const order = await makeOrder(db, { pay: false });
    const result = await trackOrder(input(order.number, "9876543210"), freshIp());
    expect(result.ok && result.tracking).toMatchObject({ status: "pending_payment", current: null });
  });
});

describe("history and the buyer's own tracking", () => {
  it("lists only the user's orders, newest first", async () => {
    const mine = await makeOrder(db);
    const second = await makeOrder(db, { userId: mine.userId, pay: false });
    const someoneElse = await makeOrder(db);

    const list = await listOrdersForUser(mine.userId);
    expect(list.orders.map((order) => order.id)).toEqual([second.orderId, mine.orderId]);
    expect(list.orders[1]).toMatchObject({ status: "paid", itemCount: 1, shipmentStatus: null });
    expect(list.orders[1]?.names).toHaveLength(1);

    expect(await readTrackingForUser(mine.userId, mine.orderId)).not.toBeNull();
    expect(await readTrackingForUser(mine.userId, someoneElse.orderId)).toBeNull();
    expect(await readTrackingForUser(mine.userId, "bad")).toBeNull();
  });
});
