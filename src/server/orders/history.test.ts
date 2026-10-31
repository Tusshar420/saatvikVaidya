import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { orderRangeBounds } from "@/lib/order-ranges";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { captureMessages } from "../../../tests/setup/auth";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeOrder } from "../../../tests/setup/orders";
import { makeUser } from "../../../tests/setup/shop";
import { listBuyAgainForUser, listOrdersForUser } from "./history";

// /orders: the period filter on the purchase history, and the "Buy again"
// row built from the buyer's paid orders.

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
  captureMessages();
});

afterAll(async () => {
  await db.$disconnect();
});

const placedAt = (orderId: string, createdAt: Date) => db.order.update({ where: { id: orderId }, data: { createdAt } });

describe("listOrdersForUser", () => {
  it("keeps only the orders of the chosen period", async () => {
    const userId = await makeUser(db);
    const now = await makeOrder(db, { userId });
    const lastYear = await makeOrder(db, { userId });
    const { from } = orderRangeBounds("lastyear");
    await placedAt(lastYear.orderId, new Date(from!.getTime() + 40 * 24 * 3600_000));

    const ids = async (range: Parameters<typeof listOrdersForUser>[2]) =>
      (await listOrdersForUser(userId, 1, range)).orders.map((order) => order.id);
    expect(await ids("all")).toEqual([now.orderId, lastYear.orderId]);
    expect(await ids("month")).toEqual([now.orderId]);
    expect(await ids("year")).toEqual([now.orderId]);
    expect(await ids("lastyear")).toEqual([lastYear.orderId]);
    expect((await listOrdersForUser(userId, 1, "lastyear")).total).toBe(1);
  });

  it("gives each order the first product's mark for its thumbnail", async () => {
    const order = await makeOrder(db);
    const [row] = (await listOrdersForUser(order.userId)).orders;
    expect(row).toMatchObject({ id: order.orderId, image: null, itemCount: 1 });
    expect(row?.glyph).not.toBeUndefined();
  });
});

describe("listBuyAgainForUser", () => {
  it("lists products from paid orders, newest first, each once", async () => {
    const userId = await makeUser(db);
    const older = await makeOrder(db, { userId });
    const newer = await makeOrder(db, { userId });
    await placedAt(older.orderId, new Date(Date.now() - 5 * 24 * 3600_000));

    const items = await listBuyAgainForUser(userId);
    expect(items.map((item) => item.productId)).toEqual([newer.productId, older.productId]);
    expect(items[0]).toMatchObject({ moq: 1, outOfStock: false });
  });

  it("leaves out unpaid and cancelled orders, products off sale and other buyers", async () => {
    const userId = await makeUser(db);
    await makeOrder(db, { userId, pay: false });
    const cancelled = await makeOrder(db, { userId });
    await db.order.update({ where: { id: cancelled.orderId }, data: { status: "cancelled" } });
    const offSale = await makeOrder(db, { userId });
    await db.product.update({ where: { id: offSale.productId }, data: { active: false } });
    await makeOrder(db);

    expect(await listBuyAgainForUser(userId)).toEqual([]);
  });

  it("stops at the limit", async () => {
    const userId = await makeUser(db);
    for (let i = 0; i < 3; i += 1) await makeOrder(db, { userId });
    expect(await listBuyAgainForUser(userId, 2)).toHaveLength(2);
  });
});
