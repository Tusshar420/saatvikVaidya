import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { makeableByProduct } from "@/server/inventory/availability";
import { seedDatabase } from "@/server/seed";
import { clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin } from "../../../tests/setup/orders";
import { makeProduct } from "../../../tests/setup/shop";
import {
  adjustStockAction,
  createComponent,
  filterB2b,
  parseB2bFilters,
  parseB2cFilters,
  parseRecipeForm,
  readB2bOverview,
  readB2cOverview,
  readStockAlerts,
  receiveStockAction,
  saveRecipe,
  updateItemSettings,
  writeOffExpiredAction,
  type CanMakeRow,
  type ComponentRow,
} from "./inventory";

// Inventory in the admin panel: validated stock-room actions, the B2C and
// B2B views, recipes and the dashboard alerts.

let adminId: string;

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

const date = (offset: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset)).toISOString().slice(0, 10);
};

async function stocked(quantity = 0) {
  const product = await makeProduct(db, { stock: 0 });
  const { id: itemId } = await db.stockItem.findUniqueOrThrow({ where: { productId: product.id }, select: { id: true } });
  if (quantity > 0) {
    await receiveStockAction({ itemId: String(itemId), quantity: String(quantity), entryUnit: "pcs", batchNo: "B1", expiryDate: date(200) }, adminId);
  }
  return { product, itemId };
}

describe("receiveStockAction", () => {
  it("receives a batch with dates and the admin's name on the movement", async () => {
    const { itemId } = await stocked();
    const result = await receiveStockAction(
      { itemId: String(itemId), quantity: "120", entryUnit: "pcs", batchNo: "LOT-9", mfgDate: date(-10), expiryDate: date(400), unitCost: "42.50", reason: "Supplier invoice 77" },
      adminId,
    );
    expect(result.ok).toBe(true);
    const batch = await db.stockBatch.findFirstOrThrow({ where: { itemId } });
    expect(batch).toMatchObject({ batchNo: "LOT-9", qtyOnHand: 120 });
    expect((await db.stockItem.findUniqueOrThrow({ where: { id: itemId } })).purchaseCostPaise).toBe(4250);
    expect(await db.stockMovement.findFirstOrThrow({ where: { itemId } })).toMatchObject({ type: "receipt", userId: adminId, reason: "Supplier invoice 77" });
  });

  it("explains bad input per field and changes nothing", async () => {
    const { itemId } = await stocked();
    const result = await receiveStockAction(
      { itemId: String(itemId), quantity: "-5", entryUnit: "pcs", mfgDate: "2026-02-30", expiryDate: "soon", unitCost: "abc" },
      adminId,
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["expiryDate", "mfgDate", "quantity", "unitCost"]);
    expect((await db.stockItem.findUniqueOrThrow({ where: { id: itemId } })).onHand).toBe(0);
  });

  it("refuses to receive stock that has already expired, and an expiry before the made date", async () => {
    const { itemId } = await stocked();
    const old = await receiveStockAction({ itemId: String(itemId), quantity: "5", entryUnit: "pcs", expiryDate: date(-1) }, adminId);
    expect(old).toMatchObject({ ok: false });
    const swapped = await receiveStockAction({ itemId: String(itemId), quantity: "5", entryUnit: "pcs", mfgDate: date(10), expiryDate: date(5) }, adminId);
    expect(swapped).toMatchObject({ ok: false });
  });

  it("takes litres and kilograms for components", async () => {
    const created = await createComponent({ kind: "base", name: "Syrup base", unit: "ml", lowThreshold: "5000" }, adminId);
    if (!created.ok) throw new Error("not created");
    expect((await receiveStockAction({ itemId: String(created.id), quantity: "2.5", entryUnit: "L" }, adminId)).ok).toBe(true);
    const item = await db.stockItem.findUniqueOrThrow({ where: { id: created.id } });
    expect(item).toMatchObject({ onHand: 2500, lowThreshold: 5000, kind: "base" });
    // A unit the item doesn't use is refused.
    expect((await receiveStockAction({ itemId: String(created.id), quantity: "1", entryUnit: "kg" }, adminId)).ok).toBe(false);
  });
});

describe("adjustStockAction and writeOffExpiredAction", () => {
  it("needs a reason and a batch, and records who adjusted", async () => {
    const { itemId } = await stocked(20);
    const batch = await db.stockBatch.findFirstOrThrow({ where: { itemId } });
    const base = { itemId: String(itemId), batchId: String(batch.id), direction: "remove", quantity: "3", entryUnit: "pcs" };
    expect(await adjustStockAction({ ...base, reason: "" }, adminId)).toMatchObject({ ok: false });
    expect(await adjustStockAction({ ...base, batchId: "", reason: "Count" }, adminId)).toMatchObject({ ok: false, fieldErrors: { batchId: expect.any(String) } });
    expect((await adjustStockAction({ ...base, reason: "Damaged in transit" }, adminId)).ok).toBe(true);
    expect((await db.stockBatch.findUniqueOrThrow({ where: { id: batch.id } })).qtyOnHand).toBe(17);
    expect(await db.stockMovement.findFirstOrThrow({ where: { itemId, type: "adjustment" } })).toMatchObject({ userId: adminId, reason: "Damaged in transit" });
  });

  it("writes off only expired stock", async () => {
    const { itemId } = await stocked(10);
    const fresh = await db.stockBatch.findFirstOrThrow({ where: { itemId } });
    expect(await writeOffExpiredAction(fresh.id, adminId)).toMatchObject({ ok: false });
    const stale = await db.stockBatch.create({ data: { itemId, batchNo: "STALE", qtyOnHand: 4, expiryDate: new Date(`${date(-3)}T00:00:00Z`) } });
    await db.stockItem.update({ where: { id: itemId }, data: { onHand: { increment: 4 } } });
    expect((await writeOffExpiredAction(stale.id, adminId)).ok).toBe(true);
    expect((await db.stockItem.findUniqueOrThrow({ where: { id: itemId } })).onHand).toBe(10);
  });
});

describe("B2C overview", () => {
  it("splits by partner brand and finds low stock, expiring and expired batches", async () => {
    const partner = await db.brand.create({
      data: { key: "partner-x", name: "Partner X", monogram: "PX", tone: "TEAL", eyebrow: "e", description: "d", linkLabel: "l", isPartner: true },
    });
    const own = await stocked(100);
    const theirs = await stocked(0);
    await db.product.update({ where: { id: theirs.product.id }, data: { brandId: partner.id } });
    await receiveStockAction({ itemId: String(theirs.itemId), quantity: "6", entryUnit: "pcs", batchNo: "SOON", expiryDate: date(20) }, adminId);
    await db.stockItem.update({ where: { id: theirs.itemId }, data: { lowThreshold: 10 } });

    const all = await readB2cOverview(parseB2cFilters({}));
    expect(all.rows.map((row) => row.id)).toEqual(expect.arrayContaining([own.itemId, theirs.itemId]));
    const partners = await readB2cOverview(parseB2cFilters({ partner: "1" }));
    expect(partners.rows.map((row) => row.id)).toEqual([theirs.itemId]);
    expect(partners.rows[0]).toMatchObject({ isPartner: true, brandName: "Partner X", sellable: 6, low: true, soonBatches: 1 });
    expect((await readB2cOverview(parseB2cFilters({ view: "low", brand: String(partner.id) }))).rows).toHaveLength(1);
    expect((await readB2cOverview(parseB2cFilters({ view: "expiring" }))).rows.map((row) => row.id)).toContain(theirs.itemId);
    expect((await readB2cOverview(parseB2cFilters({ view: "expired" }))).rows.map((row) => row.id)).not.toContain(theirs.itemId);
  });

  it("ignores junk in the filters", () => {
    expect(parseB2cFilters({ view: "<script>", page: "-4", brand: "x", q: "  " })).toMatchObject({ view: "all", page: 1, brandId: null, q: null });
  });
});

describe("components and recipes", () => {
  it("parses the recipe form: edits, removals and one new line", () => {
    expect(parseRecipeForm({ "qty-3": "2", "qty-4": "100", "remove-4": "on", newComponent: "7", newQuantity: "5" })).toEqual({
      lines: [
        { componentId: 3, quantity: 2 },
        { componentId: 7, quantity: 5 },
      ],
    });
    expect(parseRecipeForm({ "qty-3": "0" })).toMatchObject({ fieldErrors: { "qty-3": expect.any(String) } });
    expect(parseRecipeForm({ "qty-3": "2", newComponent: "3", newQuantity: "1" })).toMatchObject({ fieldErrors: { newComponent: expect.any(String) } });
    expect(parseRecipeForm({ newComponent: "3", newQuantity: "1.5" })).toMatchObject({ fieldErrors: { newQuantity: expect.any(String) } });
  });

  it("saves a recipe that changes what can be made, shared by two products", async () => {
    const bottle = await createComponent({ kind: "packaging", name: "Bottle 200 ml", unit: "pcs", componentType: "bottle" }, adminId);
    const cap = await createComponent({ kind: "packaging", name: "Cap", unit: "pcs", componentType: "cap" }, adminId);
    if (!bottle.ok || !cap.ok) throw new Error("components");
    await receiveStockAction({ itemId: String(bottle.id), quantity: "300", entryUnit: "pcs" }, adminId);
    await receiveStockAction({ itemId: String(cap.id), quantity: "80", entryUnit: "pcs" }, adminId);
    const a = await makeProduct(db, { brand: { minQty: 10, unitPricePaise: 20_000 } });
    const b = await makeProduct(db, { brand: { minQty: 10, unitPricePaise: 20_000 } });

    expect((await saveRecipe(a.id, { newComponent: String(bottle.id), newQuantity: "1" }, adminId)).ok).toBe(true);
    expect((await saveRecipe(b.id, { newComponent: String(bottle.id), newQuantity: "2" }, adminId)).ok).toBe(true);
    expect((await makeableByProduct([a.id, b.id])).get(a.id)).toBe(300);
    expect((await makeableByProduct([a.id, b.id])).get(b.id)).toBe(150);
    // Add the cap to one recipe: its 80 caps become the limit.
    await saveRecipe(a.id, { [`qty-${bottle.id}`]: "1", newComponent: String(cap.id), newQuantity: "1" }, adminId);
    expect((await makeableByProduct([a.id])).get(a.id)).toBe(80);

    const overview = await readB2bOverview();
    expect(overview.canMake.find((row) => row.id === a.id)).toMatchObject({ makeable: 80, limitedBy: expect.stringContaining("Cap"), lineCount: 2 });
    expect(overview.components.find((row) => row.id === bottle.id)).toMatchObject({ usedBy: 2, available: 300 });
    expect(await db.adminLog.count({ where: { action: "inventory.recipe.update", resourceId: String(a.id) } })).toBe(2);
  });

  it("refuses a finished item as a component and a missing product", async () => {
    const { product, itemId } = await stocked();
    const result = await saveRecipe(product.id, { newComponent: String(itemId), newQuantity: "1" }, adminId);
    expect(result).toMatchObject({ ok: false });
    expect(await saveRecipe(999_999, {}, adminId)).toMatchObject({ ok: false });
  });

  it("alerts per component, not per branded item, and keeps packaging in pieces", async () => {
    expect(await createComponent({ kind: "packaging", name: "Tube", unit: "ml" }, adminId)).toMatchObject({ ok: false, fieldErrors: { unit: expect.any(String) } });
    const bottle = await createComponent({ kind: "packaging", name: "200 ml bottles", unit: "pcs", lowThreshold: "50" }, adminId);
    if (!bottle.ok) throw new Error("component");
    await receiveStockAction({ itemId: String(bottle.id), quantity: "40", entryUnit: "pcs" }, adminId);
    const alerts = await readStockAlerts();
    expect(alerts.lowComponents).toContainEqual({ id: bottle.id, name: "200 ml bottles", available: 40, unit: "pcs" });
    // A made-to-order base never alerts.
    const base = await createComponent({ kind: "base", name: "Made-to-order base", unit: "g", lowThreshold: "500", madeToOrder: "on" }, adminId);
    if (!base.ok) throw new Error("base");
    expect((await readStockAlerts()).lowComponents.map((item) => item.id)).not.toContain(base.id);
  });

  it("changes the alert level and logs it", async () => {
    const bottle = await createComponent({ kind: "packaging", name: "Jar", unit: "pcs" }, adminId);
    if (!bottle.ok) throw new Error("component");
    const result = await updateItemSettings({ itemId: String(bottle.id), lowThreshold: "25", entryUnit: "pcs", name: "Jar 100 g", componentType: "jar", active: "on" }, adminId);
    expect(result.ok).toBe(true);
    expect(await db.stockItem.findUniqueOrThrow({ where: { id: bottle.id } })).toMatchObject({ name: "Jar 100 g", lowThreshold: 25, componentType: "jar" });
    expect(await updateItemSettings({ itemId: String(bottle.id), lowThreshold: "-1", entryUnit: "pcs", name: "Jar" }, adminId)).toMatchObject({ ok: false });
    expect(await db.adminLog.count({ where: { action: "inventory.item.update", resourceId: String(bottle.id) } })).toBe(1);
  });
});

describe("B2B list search, filters and sorting", () => {
  const component = (row: Partial<ComponentRow> & Pick<ComponentRow, "id" | "name">): ComponentRow => ({
    sku: null,
    kind: "packaging",
    unit: "pcs",
    componentType: "bottle",
    onHand: 100,
    reserved: 0,
    available: 100,
    lowThreshold: 0,
    low: false,
    madeToOrder: false,
    active: true,
    usedBy: 1,
    ...row,
  });
  const product = (row: Partial<CanMakeRow> & Pick<CanMakeRow, "id" | "name">): CanMakeRow => ({
    packSize: "200 ml",
    unitLabel: "bottles",
    minQty: 1,
    lineCount: 2,
    makeable: 50,
    limitedBy: null,
    ...row,
  });
  const overview = {
    components: [
      component({ id: 1, name: "Jar 250 g", componentType: "jar", available: 600 }),
      component({ id: 2, name: "Amber bottle 200 ml", sku: "AMB-200", available: 2000 }),
      component({ id: 3, name: "Jar 100 g", componentType: "jar", available: 10, low: true }),
      component({ id: 4, name: "Syrup base", kind: "base", unit: "ml", componentType: null, madeToOrder: true }),
      component({ id: 5, name: "Old cap", componentType: "cap", active: false }),
    ],
    canMake: [
      product({ id: 10, name: "Triphala syrup", makeable: 300 }),
      product({ id: 11, name: "Ashwagandha oil", lineCount: 0, makeable: null }),
      product({ id: 12, name: "Brahmi oil", makeable: 0 }),
      product({ id: 13, name: "Neem tablets", makeable: null, packSize: "60 tablets" }),
    ],
  };
  const ids = (rows: { id: number }[]) => rows.map((row) => row.id);
  const run = (params: Record<string, string>) => filterB2b(overview, parseB2bFilters(params));

  it("searches, filters and sorts the components", () => {
    expect(ids(run({}).components)).toEqual([2, 3, 1, 5, 4]);
    expect(ids(run({ q: "jar" }).components)).toEqual([3, 1]);
    expect(ids(run({ q: "amb-2" }).components)).toEqual([2]);
    expect(ids(run({ type: "jar" }).components)).toEqual([3, 1]);
    expect(ids(run({ type: "base" }).components)).toEqual([4]);
    expect(ids(run({ status: "low" }).components)).toEqual([3]);
    expect(ids(run({ status: "made" }).components)).toEqual([4]);
    expect(ids(run({ status: "inactive" }).components)).toEqual([5]);
    expect(ids(run({ status: "ok" }).components)).toEqual([2, 1]);
    // Ties go by name.
    expect(ids(run({ sort: "-available" }).components)).toEqual([2, 1, 5, 4, 3]);
    expect(ids(run({ sort: "type" }).components)).toEqual([2, 5, 3, 1, 4]);
  });

  it("searches, filters, sorts and pages the brand products", () => {
    expect(ids(run({}).products)).toEqual([11, 12, 13, 10]);
    expect(ids(run({ pq: "oil" }).products)).toEqual([11, 12]);
    expect(ids(run({ pq: "60 tab" }).products)).toEqual([13]);
    expect(ids(run({ recipe: "none" }).products)).toEqual([11]);
    expect(ids(run({ recipe: "set" }).products)).toEqual([12, 13, 10]);
    expect(ids(run({ recipe: "zero" }).products)).toEqual([12]);
    // "No limit" counts as the most; no recipe always goes last.
    expect(ids(run({ psort: "-canMake" }).products)).toEqual([13, 10, 12, 11]);
    expect(ids(run({ psort: "canMake" }).products)).toEqual([12, 10, 13, 11]);
    expect(run({ ppage: "9" })).toMatchObject({ page: 1, pageCount: 1, productTotal: 4 });
  });

  it("drops bad values instead of failing", () => {
    expect(parseB2bFilters({ type: "<x>", status: "nope", recipe: "?", sort: "price", psort: "-x", ppage: "-2", q: " " })).toMatchObject({
      type: null,
      status: "all",
      recipe: "all",
      sort: { key: "name", dir: "asc" },
      psort: { key: "name", dir: "asc" },
      ppage: 1,
      q: null,
    });
  });
});
