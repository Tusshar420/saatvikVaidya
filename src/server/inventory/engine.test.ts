import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin } from "../../../tests/setup/orders";
import { componentLinesFor, componentShortfalls, makeableByProduct, sellableByProduct } from "./availability";
import {
  StockError,
  adjustStock,
  commitReservations,
  receiveStock,
  releaseLapsed,
  releaseReservations,
  reserveStock,
  returnSale,
  writeOffExpired,
} from "./engine";

// The stock engine: reservations and consumption, first-expiry-first-out,
// expired stock, returns into the same batch, and recipe availability.

let adminId: string;
let counter = 0;

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  adminId = await makeAdmin(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const day = (offset: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
};
const ref = (id = `o${++counter}`) => ({ type: "order" as const, id });
const brandRef = () => ({ type: "brand_order" as const, id: `b${++counter}` });
const tx = <T>(run: (client: Prisma.TransactionClient) => Promise<T>) => db.$transaction(run);

async function finishedItem(batches: { batchNo: string; qty: number; expiry?: Date | null }[] = []) {
  counter += 1;
  const form = await db.category.findFirstOrThrow({ where: { kind: "FORM" } });
  const product = await db.product.create({
    data: {
      slug: `engine-test-${counter}`,
      name: `Engine product ${counter}`,
      formId: form.id,
      description: "x",
      packSize: "60 tablets",
      mrpPaise: 10_000,
      professionalPricePaise: 8_000,
      gstRate: 5,
      hsnCode: "30049011",
      brandEligible: true,
      brandMinQty: 4,
    },
  });
  const item = await db.stockItem.create({ data: { kind: "finished", name: product.name, productId: product.id } });
  for (const batch of batches) {
    await tx((t) =>
      receiveStock(t, { itemId: item.id, quantity: batch.qty, batchNo: batch.batchNo, expiryDate: batch.expiry ?? null }),
    );
  }
  return { item, product };
}

async function component(name: string, onHand: number, extra: { madeToOrder?: boolean; unit?: "pcs" | "ml" | "g" } = {}) {
  counter += 1;
  const item = await db.stockItem.create({
    data: {
      kind: extra.unit && extra.unit !== "pcs" ? "base" : "packaging",
      name: `${name} ${counter}`,
      unit: extra.unit ?? "pcs",
      madeToOrder: extra.madeToOrder ?? false,
    },
  });
  if (onHand > 0) await tx((t) => receiveStock(t, { itemId: item.id, quantity: onHand }));
  return item;
}

const batchQty = async (itemId: number) =>
  Object.fromEntries(
    (await db.stockBatch.findMany({ where: { itemId } })).map((b) => [b.batchNo, [b.qtyOnHand, b.qtyReserved]]),
  );
const itemOf = (id: number) => db.stockItem.findUniqueOrThrow({ where: { id } });

describe("B2C: reserving and selling first-expiry-first-out", () => {
  it("takes from the earliest-expiring batch first, undated batches last", async () => {
    const { item } = await finishedItem([
      { batchNo: "NO-DATE", qty: 10 },
      { batchNo: "LATE", qty: 10, expiry: day(300) },
      { batchNo: "EARLY", qty: 5, expiry: day(90) },
    ]);
    await tx((t) => reserveStock(t, [{ itemId: item.id, quantity: 12 }], ref()));
    // 5 from EARLY, then 7 from LATE; NO-DATE untouched.
    expect(await batchQty(item.id)).toEqual({ EARLY: [5, 5], LATE: [10, 7], "NO-DATE": [10, 0] });
    expect(await itemOf(item.id)).toMatchObject({ onHand: 25, reserved: 12 });
  });

  it("never sells an expired batch", async () => {
    const { item, product } = await finishedItem([
      { batchNo: "OLD", qty: 50, expiry: day(-1) },
      { batchNo: "FRESH", qty: 3, expiry: day(200) },
    ]);
    expect((await sellableByProduct([product.id])).get(product.id)).toBe(3);
    await expect(tx((t) => reserveStock(t, [{ itemId: item.id, quantity: 4 }], ref()))).rejects.toMatchObject({
      code: "insufficient",
      detail: { available: 3 },
    });
    await tx((t) => reserveStock(t, [{ itemId: item.id, quantity: 3 }], ref()));
    expect((await batchQty(item.id)).OLD).toEqual([50, 0]);
  });

  it("turns a hold into a sale once, with a movement per batch", async () => {
    const { item } = await finishedItem([{ batchNo: "A", qty: 4, expiry: day(30) }, { batchNo: "B", qty: 10, expiry: day(60) }]);
    const order = ref();
    await tx((t) => reserveStock(t, [{ itemId: item.id, quantity: 6 }], order));
    expect(await tx((t) => commitReservations(t, order, "sale"))).toBe(2);
    expect(await tx((t) => commitReservations(t, order, "sale"))).toBe(0);
    expect(await itemOf(item.id)).toMatchObject({ onHand: 8, reserved: 0 });
    expect(await batchQty(item.id)).toEqual({ A: [0, 0], B: [8, 0] });
    const sales = await db.stockMovement.findMany({ where: { refType: "order", refId: order.id, type: "sale" } });
    expect(sales.map((m) => m.quantity).sort()).toEqual([2, 4]);
  });

  it("releases a hold exactly once and the stock is on sale again", async () => {
    const { item, product } = await finishedItem([{ batchNo: "A", qty: 5 }]);
    const order = ref();
    await tx((t) => reserveStock(t, [{ itemId: item.id, quantity: 5 }], order));
    expect((await sellableByProduct([product.id])).get(product.id)).toBe(0);
    expect(await tx((t) => releaseReservations(t, order, "Payment failed"))).toBe(1);
    expect(await tx((t) => releaseReservations(t, order, "Payment failed"))).toBe(0);
    expect(await itemOf(item.id)).toMatchObject({ onHand: 5, reserved: 0 });
    expect((await sellableByProduct([product.id])).get(product.id)).toBe(5);
  });

  it("gives back a lapsed hold when the next order needs it", async () => {
    const { item } = await finishedItem([{ batchNo: "A", qty: 2 }]);
    await tx((t) => reserveStock(t, [{ itemId: item.id, quantity: 2 }], ref(), { expiresAt: new Date(Date.now() - 1000) }));
    await tx((t) => reserveStock(t, [{ itemId: item.id, quantity: 2 }], ref()));
    expect(await itemOf(item.id)).toMatchObject({ onHand: 2, reserved: 2 });
    expect(await tx((t) => releaseLapsed(t))).toBe(0);
  });

  it("is all or nothing across items", async () => {
    const a = await finishedItem([{ batchNo: "A", qty: 5 }]);
    const b = await finishedItem([{ batchNo: "B", qty: 1 }]);
    await expect(
      tx((t) =>
        reserveStock(
          t,
          [
            { itemId: a.item.id, quantity: 3 },
            { itemId: b.item.id, quantity: 2 },
          ],
          ref(),
        ),
      ),
    ).rejects.toBeInstanceOf(StockError);
    expect(await itemOf(a.item.id)).toMatchObject({ reserved: 0 });
  });

  it("gives the last unit to only one of two orders at once", async () => {
    const { item } = await finishedItem([{ batchNo: "A", qty: 1 }]);
    const results = await Promise.allSettled([
      tx((t) => reserveStock(t, [{ itemId: item.id, quantity: 1 }], ref())),
      tx((t) => reserveStock(t, [{ itemId: item.id, quantity: 1 }], ref())),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await itemOf(item.id)).toMatchObject({ onHand: 1, reserved: 1 });
  });

  it("puts a cancelled or refunded sale back into the same batches, once", async () => {
    const { item } = await finishedItem([{ batchNo: "A", qty: 3, expiry: day(30) }, { batchNo: "B", qty: 9, expiry: day(90) }]);
    const order = ref();
    await tx((t) => reserveStock(t, [{ itemId: item.id, quantity: 5 }], order));
    await tx((t) => commitReservations(t, order, "sale"));
    expect(await batchQty(item.id)).toEqual({ A: [0, 0], B: [7, 0] });
    expect(await tx((t) => returnSale(t, order, { userId: adminId, reason: "Cancelled" }))).toBe(2);
    expect(await tx((t) => returnSale(t, order))).toBe(0);
    expect(await batchQty(item.id)).toEqual({ A: [3, 0], B: [9, 0] });
    expect((await itemOf(item.id)).onHand).toBe(12);
  });
});

describe("receiving, adjusting and writing off", () => {
  it("adds to an existing batch of the same number, and refuses a different expiry", async () => {
    const { item } = await finishedItem([{ batchNo: "X1", qty: 5, expiry: day(100) }]);
    await tx((t) => receiveStock(t, { itemId: item.id, quantity: 5, batchNo: "X1", expiryDate: day(100) }));
    expect((await batchQty(item.id)).X1).toEqual([10, 0]);
    await expect(
      tx((t) => receiveStock(t, { itemId: item.id, quantity: 1, batchNo: "X1", expiryDate: day(200) })),
    ).rejects.toMatchObject({ code: "batch_clash" });
  });

  it("makes a batch number when none is given, and records the receipt", async () => {
    const { item } = await finishedItem();
    const { batchId } = await tx((t) => receiveStock(t, { itemId: item.id, quantity: 7, userId: adminId }));
    expect(batchId).not.toBeNull();
    const movement = await db.stockMovement.findFirstOrThrow({ where: { itemId: item.id } });
    expect(movement).toMatchObject({ type: "receipt", quantity: 7, onHandAfter: 7, userId: adminId });
  });

  it("needs a reason and the admin for an adjustment, and won't go below what is held", async () => {
    const { item } = await finishedItem([{ batchNo: "A", qty: 10 }]);
    const batch = await db.stockBatch.findFirstOrThrow({ where: { itemId: item.id } });
    await expect(
      tx((t) => adjustStock(t, { itemId: item.id, batchId: batch.id, delta: -2, reason: "  ", userId: adminId })),
    ).rejects.toMatchObject({ code: "reason_required" });
    await expect(
      tx((t) => adjustStock(t, { itemId: item.id, delta: -2, reason: "Count", userId: adminId })),
    ).rejects.toMatchObject({ code: "batch_required" });
    await tx((t) => reserveStock(t, [{ itemId: item.id, quantity: 8 }], ref()));
    await expect(
      tx((t) => adjustStock(t, { itemId: item.id, batchId: batch.id, delta: -3, reason: "Damaged", userId: adminId })),
    ).rejects.toMatchObject({ code: "below_reserved" });
    await tx((t) => adjustStock(t, { itemId: item.id, batchId: batch.id, delta: -2, reason: "Damaged", userId: adminId }));
    expect(await itemOf(item.id)).toMatchObject({ onHand: 8, reserved: 8 });
    const movement = await db.stockMovement.findFirstOrThrow({ where: { itemId: item.id, type: "adjustment" } });
    expect(movement).toMatchObject({ reason: "Damaged", userId: adminId, onHandDelta: -2 });
  });

  it("writes off an expired batch, but not a fresh one and not what is held", async () => {
    const { item } = await finishedItem([{ batchNo: "FRESH", qty: 4, expiry: day(40) }]);
    const fresh = await db.stockBatch.findFirstOrThrow({ where: { itemId: item.id } });
    await expect(tx((t) => writeOffExpired(t, { batchId: fresh.id, userId: adminId }))).rejects.toMatchObject({
      code: "not_expired",
    });
    const stale = await db.stockBatch.create({ data: { itemId: item.id, batchNo: "STALE", qtyOnHand: 6, expiryDate: day(-2) } });
    await db.stockItem.update({ where: { id: item.id }, data: { onHand: { increment: 6 } } });
    expect(await tx((t) => writeOffExpired(t, { batchId: stale.id, userId: adminId }))).toBe(6);
    expect((await batchQty(item.id)).STALE).toEqual([0, 0]);
    expect((await itemOf(item.id)).onHand).toBe(4);
    const movement = await db.stockMovement.findFirstOrThrow({ where: { itemId: item.id, type: "expiry_write_off" } });
    expect(movement).toMatchObject({ quantity: 6, userId: adminId });
  });
});

describe("B2B: components, reservation and consumption", () => {
  it("reserves for a confirmed order, consumes in production, releases on cancel", async () => {
    const bottle = await component("Bottle", 100);
    const base = await component("Base", 50_000, { unit: "ml" });
    const confirmed = brandRef();
    await tx((t) =>
      reserveStock(t, [{ itemId: bottle.id, quantity: 40 }, { itemId: base.id, quantity: 8000 }], confirmed),
    );
    expect(await itemOf(bottle.id)).toMatchObject({ onHand: 100, reserved: 40 });
    await tx((t) => commitReservations(t, confirmed, "consumption"));
    expect(await itemOf(bottle.id)).toMatchObject({ onHand: 60, reserved: 0 });
    expect(await itemOf(base.id)).toMatchObject({ onHand: 42_000, reserved: 0 });

    const cancelled = brandRef();
    await tx((t) => reserveStock(t, [{ itemId: bottle.id, quantity: 30 }], cancelled));
    await tx((t) => releaseReservations(t, cancelled, "Order cancelled"));
    expect(await itemOf(bottle.id)).toMatchObject({ onHand: 60, reserved: 0 });
    const types = (await db.stockMovement.findMany({ where: { itemId: bottle.id }, orderBy: { id: "asc" } })).map((m) => m.type);
    expect(types).toEqual(["receipt", "reservation", "consumption", "reservation", "release"]);
  });

  it("holds a paid order's components even past the stock (a shortfall), and consumes only what is there", async () => {
    const cap = await component("Cap", 10);
    const order = brandRef();
    await expect(tx((t) => reserveStock(t, [{ itemId: cap.id, quantity: 15 }], order))).rejects.toMatchObject({ code: "insufficient" });
    await tx((t) => reserveStock(t, [{ itemId: cap.id, quantity: 15 }], order, { allowShortfall: true }));
    expect(await itemOf(cap.id)).toMatchObject({ onHand: 10, reserved: 15 });
    await tx((t) => commitReservations(t, order, "consumption"));
    expect(await itemOf(cap.id)).toMatchObject({ onHand: 0, reserved: 0 });
  });
});

describe("recipes: what can be made", () => {
  async function launchProduct(minQty: number, recipe: { componentId: number; quantity: number }[]) {
    const { product } = await finishedItem();
    await db.product.update({ where: { id: product.id }, data: { brandMinQty: minQty } });
    await db.recipeLine.createMany({ data: recipe.map((line) => ({ productId: product.id, ...line })) });
    return product;
  }

  it("is the minimum over the recipe, in steps of the minimum order", async () => {
    const bottle = await component("Bottle 200", 530);
    const cap = await component("Cap", 900);
    const syrup = await component("Syrup base", 90_000, { unit: "ml" });
    const product = await launchProduct(25, [
      { componentId: bottle.id, quantity: 1 },
      { componentId: cap.id, quantity: 1 },
      { componentId: syrup.id, quantity: 200 },
    ]);
    // 90,000 / 200 = 450 is the smallest; 450 is already a multiple of 25.
    expect((await makeableByProduct([product.id])).get(product.id)).toBe(450);
    await db.stockItem.update({ where: { id: bottle.id }, data: { reserved: 140 } });
    // Available bottles 390 -> 375 in steps of 25.
    expect((await makeableByProduct([product.id])).get(product.id)).toBe(375);
  });

  it("is not limited by a made-to-order base, nor without a recipe", async () => {
    const jar = await component("Jar", 12);
    const base = await component("Churna base", 0, { unit: "g", madeToOrder: true });
    const withBase = await launchProduct(4, [
      { componentId: jar.id, quantity: 1 },
      { componentId: base.id, quantity: 100 },
    ]);
    const bare = await launchProduct(4, []);
    const result = await makeableByProduct([withBase.id, bare.id]);
    expect(result.get(withBase.id)).toBe(12);
    expect(result.get(bare.id)).toBeNull();
    // Nothing is held for a made-to-order base.
    expect(await componentLinesFor([{ productId: withBase.id, quantity: 8 }])).toEqual([{ itemId: jar.id, quantity: 8 }]);
  });

  it("adds up a component shared by two products in one order", async () => {
    const bottle = await component("Shared bottle", 10);
    const a = await launchProduct(1, [{ componentId: bottle.id, quantity: 1 }]);
    const b = await launchProduct(1, [{ componentId: bottle.id, quantity: 2 }]);
    // Each alone fits (6 <= 10, 3 x 2 = 6), but together they need 12.
    const lines = [
      { productId: a.id, quantity: 6 },
      { productId: b.id, quantity: 3 },
    ];
    expect(await componentShortfalls([lines[0]])).toEqual([]);
    expect(await componentShortfalls([lines[1]])).toEqual([]);
    expect(await componentShortfalls(lines)).toMatchObject([{ componentId: bottle.id, needed: 12, available: 10 }]);
    expect(await componentLinesFor(lines)).toEqual([{ itemId: bottle.id, quantity: 12 }]);
  });
});
