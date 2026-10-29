import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin, makeOrder } from "../../../tests/setup/orders";
import { makeUser } from "../../../tests/setup/shop";
import { cancelOrder } from "./orders";
import {
  bucketOf,
  bucketsBetween,
  istDay,
  readReports,
  reportFiltersSchema,
  resolveRange,
} from "./reports";

// The numbers on /admin/reports must match the orders and the coin ledger
// exactly (docs/CHUNKS.md P1.10).

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const noFilters = reportFiltersSchema.parse({});

describe("range and buckets", () => {
  const now = new Date("2026-10-02T09:00:00Z"); // 2 Oct, 14:30 in India

  it("defaults to the last 30 India days, ending today", () => {
    expect(resolveRange(noFilters, now)).toEqual({ from: "2026-09-03", to: "2026-10-02", by: "day" });
  });

  it("uses the India day around midnight", () => {
    expect(istDay(new Date("2026-10-01T19:00:00Z"))).toBe("2026-10-02");
    expect(istDay(new Date("2026-10-01T18:29:00Z"))).toBe("2026-10-01");
  });

  it("swaps a backwards range, caps it at 400 days and drops bad values", () => {
    expect(resolveRange(reportFiltersSchema.parse({ from: "2026-10-05", to: "2026-10-01" }), now)).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-05",
    });
    const long = resolveRange(reportFiltersSchema.parse({ from: "2020-01-01", to: "2026-10-01" }), now);
    expect(long.from).toBe("2025-08-28");
    expect(reportFiltersSchema.parse({ from: "nope", by: "year" })).toEqual({
      from: undefined,
      to: undefined,
      by: undefined,
    });
  });

  it("groups days into Monday weeks and months, with empty buckets filled in", () => {
    expect(bucketOf("2026-10-04", "week")).toBe("2026-09-28"); // a Sunday
    expect(bucketOf("2026-10-05", "week")).toBe("2026-10-05"); // a Monday
    expect(bucketOf("2026-10-17", "month")).toBe("2026-10");
    expect(bucketsBetween("2026-09-30", "2026-10-02", "day")).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(bucketsBetween("2026-09-30", "2026-10-12", "week")).toEqual(["2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(bucketsBetween("2026-08-15", "2026-10-02", "month")).toEqual(["2026-08", "2026-09", "2026-10"]);
  });
});

describe("readReports", () => {
  it("matches the seeded orders, users and coins", async () => {
    const adminId = await makeAdmin(db);
    const first = await makeOrder(db, { quantity: 2, mrpPaise: 32_000 });
    const second = await makeOrder(db, { quantity: 5, mrpPaise: 20_000 });
    const unpaid = await makeOrder(db, { pay: false });
    const cancelled = await makeOrder(db, { quantity: 1 });
    await cancelOrder(adminId, cancelled.orderId, "Test");
    await makeUser(db, { type: "doctor" });
    await makeUser(db, { type: "doctor" });
    await makeUser(db, { type: "pharmacy" });

    const range = resolveRange(noFilters);
    const reports = await readReports(range);

    // Sales: the two paid orders only, to the paisa.
    const paid = await db.order.findMany({
      where: { id: { in: [first.orderId, second.orderId] } },
      select: { totalPaise: true },
    });
    const expected = paid.reduce((sum, order) => sum + order.totalPaise, 0);
    expect(reports.sales.totalOrders).toBe(2);
    expect(reports.sales.totalPaise).toBe(expected);
    const today = reports.sales.buckets.find((bucket) => bucket.key === istDay(new Date()));
    expect(today).toMatchObject({ orders: 2, paise: expected });
    expect(reports.sales.buckets.reduce((sum, bucket) => sum + bucket.paise, 0)).toBe(expected);
    expect(reports.sales.buckets).toHaveLength(30);

    // Orders by status: all four were placed in the period.
    const byStatus = Object.fromEntries(reports.ordersByStatus.map((row) => [row.status, row.count]));
    expect(byStatus).toMatchObject({ paid: 2, pending_payment: 1, cancelled: 1, delivered: 0 });
    expect(unpaid.orderId).toBeTruthy();

    // Top products: bigger quantity first; revenue = the line totals.
    expect(reports.topProducts.map((product) => product.units)).toEqual([5, 2]);
    const items = await db.orderItem.findMany({
      where: { orderId: { in: [first.orderId, second.orderId] } },
      orderBy: { quantity: "desc" },
    });
    expect(reports.topProducts.map((product) => product.paise)).toEqual(
      items.map((item) => item.lineTotalPaise - item.discountPaise),
    );

    // New users by type (admins and order buyers are customers).
    const doctors = reports.newUsers.byType.find((type) => type.key === "doctor");
    const pharmacies = reports.newUsers.byType.find((type) => type.key === "pharmacy");
    expect(doctors?.count).toBe(2);
    expect(pharmacies?.count).toBe(1);
    expect(reports.newUsers.total).toBe(reports.newUsers.byType.reduce((sum, type) => sum + type.count, 0));
    // The admin account is not counted as a new user.
    expect(reports.newUsers.byType.find((type) => type.key === "customer")?.count).toBe(4);

    // Pending approvals: the three professionals just made.
    expect(reports.pendingApprovals).toBe(3);
  });

  it("counts coins issued, redeemed and taken back from the ledger", async () => {
    const adminId = await makeAdmin(db);
    const buyer = await makeUser(db);
    await db.coinLedger.createMany({
      data: [
        { userId: buyer, amount: 100, reason: "earn_order", reference: "o1" },
        { userId: buyer, amount: 30, reason: "earn_profile", reference: "details" },
        { userId: buyer, amount: 50, reason: "admin_adjust", reference: "a1", note: "Goodwill", actorId: adminId },
        { userId: buyer, amount: -20, reason: "admin_adjust", reference: "a2", note: "Correction", actorId: adminId },
        { userId: buyer, amount: -60, reason: "redeem", reference: "o2" },
        { userId: buyer, amount: 10, reason: "redeem_return", reference: "o2" },
        { userId: buyer, amount: -40, reason: "earn_reversal", reference: "o1" },
      ],
    });
    const { coins } = await readReports(resolveRange(noFilters));
    expect(coins).toEqual({ issued: 180, redeemed: 50, takenBack: 60 });
  });

  it("leaves out anything outside the period", async () => {
    await makeOrder(db);
    const range = resolveRange(reportFiltersSchema.parse({ from: "2020-01-01", to: "2020-01-31" }));
    const reports = await readReports(range);
    expect(reports.sales.totalOrders).toBe(0);
    expect(reports.sales.totalPaise).toBe(0);
    expect(reports.topProducts).toEqual([]);
    expect(reports.ordersByStatus.every((row) => row.count === 0)).toBe(true);
    expect(reports.coins).toEqual({ issued: 0, redeemed: 0, takenBack: 0 });
  });
});
