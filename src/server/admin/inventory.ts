import "server-only";
import { z } from "zod";
import type { Prisma, StockKind } from "@/generated/prisma/client";
import { inventory as copy } from "@/content/inventory";
import {
  EXPIRY_WARN_DAYS,
  componentTypes,
  daysToExpiry,
  entryUnits,
  expiryState,
  isLow,
  stockUnits,
  toBaseQuantity,
  unitsMakeable,
  type StockUnitKey,
} from "@/lib/inventory";
import { sortField, sortRows, type Sort } from "@/lib/admin-sort";
import { db } from "@/server/db";
import { StockError, adjustStock, receiveStock, writeOffExpired } from "@/server/inventory/engine";
import { logAdminAction } from "./audit";
import { blankToNull, checkbox, fieldErrorsOf } from "./form";

// The admin side of Inventory (/admin/inventory): reads for the two pages
// (B2C finished goods, B2B components and recipes) and the stock-room
// actions. All stock changes go through src/server/inventory/engine.ts, so
// they are movements with the admin who did them.

const errors = copy.errors;

// ─── Reads: B2C ─────────────────────────────────────────────────────────────

export const B2C_VIEWS = ["all", "low", "out", "expiring", "expired"] as const;
export type B2cView = (typeof B2C_VIEWS)[number];
export const INVENTORY_PAGE_SIZE = 25;
export const B2C_SORTS = ["name", "brand", "onHand", "reserved", "available", "expiry"] as const;
export const B2C_SORT_DEFAULT: Sort<(typeof B2C_SORTS)[number]> = { key: "name", dir: "asc" };

const b2cFilterSchema = z.object({
  q: z.preprocess(blankToNull, z.string().trim().max(100).nullable().catch(null)),
  brandId: z.preprocess(blankToNull, z.coerce.number().int().positive().nullable().catch(null)),
  partner: z.preprocess((value) => value === "1", z.boolean()),
  view: z.enum(B2C_VIEWS).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  sort: sortField(B2C_SORTS, B2C_SORT_DEFAULT),
});
export type B2cFilters = z.output<typeof b2cFilterSchema>;

export function parseB2cFilters(params: Record<string, string | string[] | undefined>): B2cFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return b2cFilterSchema.parse({
    q: first(params.q),
    brandId: first(params.brand),
    partner: first(params.partner),
    view: first(params.view),
    page: first(params.page),
    sort: params.sort,
  });
}

export type B2cRow = {
  id: number;
  productId: number | null;
  name: string;
  slug: string | null;
  brandName: string | null;
  isPartner: boolean;
  onHand: number;
  reserved: number;
  /** Units that can be sold now: not held, not in an expired batch. */
  sellable: number;
  lowThreshold: number;
  low: boolean;
  nearestExpiry: Date | null;
  soonBatches: number;
  expiredBatches: number;
  purchaseCostPaise: number | null;
};

export type B2cOverview = {
  filters: B2cFilters;
  rows: B2cRow[];
  total: number;
  page: number;
  pageCount: number;
  counts: { items: number; low: number; out: number; expiringBatches: number; expiredBatches: number };
  brands: { id: number; name: string; isPartner: boolean }[];
};

export async function readB2cOverview(filters: B2cFilters): Promise<B2cOverview> {
  const [items, brands] = await Promise.all([
    db.stockItem.findMany({
      where: { kind: "finished", product: { isNot: null } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        onHand: true,
        reserved: true,
        lowThreshold: true,
        purchaseCostPaise: true,
        product: { select: { id: true, slug: true, brand: { select: { name: true, isPartner: true } } } },
        batches: { where: { qtyOnHand: { gt: 0 } }, select: { qtyOnHand: true, qtyReserved: true, expiryDate: true } },
      },
    }),
    db.brand.findMany({ orderBy: [{ name: "asc" }], select: { id: true, name: true, isPartner: true } }),
  ]);
  const brandName = filters.brandId ? brands.find((brand) => brand.id === filters.brandId)?.name : undefined;
  const all = items.map((item): B2cRow => {
    let sellable = 0;
    let nearest: Date | null = null;
    let soon = 0;
    let expired = 0;
    for (const batch of item.batches) {
      const state = expiryState(batch.expiryDate);
      if (state === "expired") expired += 1;
      else {
        sellable += batch.qtyOnHand - batch.qtyReserved;
        if (state === "soon") soon += 1;
        if (batch.expiryDate && (!nearest || batch.expiryDate < nearest)) nearest = batch.expiryDate;
      }
    }
    return {
      id: item.id,
      productId: item.product?.id ?? null,
      name: item.name,
      slug: item.product?.slug ?? null,
      brandName: item.product?.brand?.name ?? null,
      isPartner: item.product?.brand?.isPartner ?? false,
      onHand: item.onHand,
      reserved: item.reserved,
      sellable,
      lowThreshold: item.lowThreshold,
      low: isLow(sellable, item.lowThreshold),
      nearestExpiry: nearest,
      soonBatches: soon,
      expiredBatches: expired,
      purchaseCostPaise: item.purchaseCostPaise,
    };
  });
  const counts = {
    items: all.length,
    low: all.filter((row) => row.low).length,
    out: all.filter((row) => row.sellable === 0).length,
    expiringBatches: all.reduce((sum, row) => sum + row.soonBatches, 0),
    expiredBatches: all.reduce((sum, row) => sum + row.expiredBatches, 0),
  };
  const q = filters.q?.toLowerCase();
  const matching = all.filter((row) => {
    if (q && !`${row.name} ${row.slug ?? ""}`.toLowerCase().includes(q)) return false;
    if (brandName && row.brandName !== brandName) return false;
    if (filters.partner && !row.isPartner) return false;
    switch (filters.view) {
      case "low":
        return row.low;
      case "out":
        return row.sellable === 0;
      case "expiring":
        return row.soonBatches > 0;
      case "expired":
        return row.expiredBatches > 0;
      default:
        return true;
    }
  });
  const filtered = sortRows(matching, filters.sort, (row, key) => {
    switch (key) {
      case "brand":
        return row.brandName;
      case "available":
        return row.sellable;
      case "expiry":
        return row.nearestExpiry;
      default:
        return row[key];
    }
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / INVENTORY_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  return {
    filters: { ...filters, page },
    rows: filtered.slice((page - 1) * INVENTORY_PAGE_SIZE, page * INVENTORY_PAGE_SIZE),
    total: filtered.length,
    page,
    pageCount,
    counts,
    brands,
  };
}

const movementSelect = {
  id: true,
  type: true,
  quantity: true,
  onHandDelta: true,
  reservedDelta: true,
  onHandAfter: true,
  reason: true,
  refType: true,
  refId: true,
  createdAt: true,
  batch: { select: { batchNo: true } },
  item: { select: { id: true, name: true, unit: true } },
  user: { select: { name: true } },
} satisfies Prisma.StockMovementSelect;

export type MovementRow = Prisma.StockMovementGetPayload<{ select: typeof movementSelect }>;

export async function readMovements(where: Prisma.StockMovementWhereInput, take = 50): Promise<MovementRow[]> {
  return db.stockMovement.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: movementSelect,
  });
}

export async function readStockItem(id: number) {
  const item = await db.stockItem.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, slug: true, name: true, brand: { select: { name: true, isPartner: true } } } },
      batches: { orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { id: "asc" }] },
      recipeLines: { select: { quantity: true, product: { select: { id: true, name: true } } } },
    },
  });
  if (!item) return null;
  return { item, movements: await readMovements({ itemId: id }) };
}

// ─── Reads: B2B ─────────────────────────────────────────────────────────────

export type ComponentRow = {
  id: number;
  name: string;
  sku: string | null;
  kind: StockKind;
  unit: StockUnitKey;
  componentType: string | null;
  onHand: number;
  reserved: number;
  available: number;
  lowThreshold: number;
  low: boolean;
  madeToOrder: boolean;
  active: boolean;
  usedBy: number;
};

export async function readB2bOverview() {
  const [components, products, movements] = await Promise.all([
    db.stockItem.findMany({
      where: { kind: { in: ["packaging", "base"] } },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      include: { _count: { select: { recipeLines: true } } },
    }),
    db.product.findMany({
      where: { brandEligible: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        packSize: true,
        brandMinQty: true,
        brandUnitLabel: true,
        recipeLines: {
          select: { quantity: true, component: { select: { id: true, name: true, unit: true, onHand: true, reserved: true, madeToOrder: true } } },
        },
      },
    }),
    readMovements({ item: { kind: { in: ["packaging", "base"] } } }, 20),
  ]);
  const rows = components.map(
    (item): ComponentRow => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      kind: item.kind,
      unit: item.unit,
      componentType: item.componentType,
      onHand: item.onHand,
      reserved: item.reserved,
      available: item.onHand - item.reserved,
      lowThreshold: item.lowThreshold,
      low: item.active && !item.madeToOrder && isLow(item.onHand - item.reserved, item.lowThreshold),
      madeToOrder: item.madeToOrder,
      active: item.active,
      usedBy: item._count.recipeLines,
    }),
  );
  const canMake = products.map((product) => {
    const lines = product.recipeLines.map((line) => ({
      componentId: line.component.id,
      quantity: line.quantity,
      madeToOrder: line.component.madeToOrder,
      available: line.component.onHand - line.component.reserved,
    }));
    const makeable = unitsMakeable(lines, product.brandMinQty ?? 1);
    // The component that runs out first.
    const limiting = product.recipeLines
      .filter((line) => !line.component.madeToOrder && line.quantity > 0)
      .map((line) => ({
        name: line.component.name,
        units: Math.floor(Math.max(0, line.component.onHand - line.component.reserved) / line.quantity),
      }))
      .sort((a, b) => a.units - b.units)[0];
    return {
      id: product.id,
      name: product.name,
      packSize: product.packSize,
      unitLabel: product.brandUnitLabel ?? "units",
      minQty: product.brandMinQty ?? 1,
      lineCount: product.recipeLines.length,
      makeable,
      limitedBy: makeable === null ? null : (limiting?.name ?? null),
    };
  });
  return { components: rows, canMake, movements };
}

export type CanMakeRow = Awaited<ReturnType<typeof readB2bOverview>>["canMake"][number];

// The B2B page has two lists, each with its own search, filter and sort:
// components (q, type, status, sort) and brand products (pq, recipe, psort,
// ppage). Both are read whole and filtered here, like the B2C list.

export const COMPONENT_STATUSES = ["all", "low", "short", "made", "inactive", "ok"] as const;
export const COMPONENT_SORTS = ["name", "type", "onHand", "reserved", "available", "usedBy"] as const;
export const RECIPE_VIEWS = ["all", "set", "none", "zero"] as const;
export const CAN_MAKE_SORTS = ["name", "recipe", "canMake"] as const;
export const COMPONENT_SORT_DEFAULT: Sort<(typeof COMPONENT_SORTS)[number]> = { key: "name", dir: "asc" };
export const CAN_MAKE_SORT_DEFAULT: Sort<(typeof CAN_MAKE_SORTS)[number]> = { key: "name", dir: "asc" };

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const searchText = z.preprocess((value) => blankToNull(first(value)), z.string().trim().max(100).nullable().catch(null));

const b2bFilterSchema = z.object({
  q: searchText,
  type: z.preprocess(first, z.enum(componentTypes).nullable().catch(null)),
  status: z.preprocess(first, z.enum(COMPONENT_STATUSES).catch("all")),
  sort: sortField(COMPONENT_SORTS, COMPONENT_SORT_DEFAULT),
  pq: searchText,
  recipe: z.preprocess(first, z.enum(RECIPE_VIEWS).catch("all")),
  psort: sortField(CAN_MAKE_SORTS, CAN_MAKE_SORT_DEFAULT),
  ppage: z.preprocess(first, z.coerce.number().int().min(1).max(10_000).catch(1)),
});
export type B2bFilters = z.output<typeof b2bFilterSchema>;

export function parseB2bFilters(params: Record<string, string | string[] | undefined>): B2bFilters {
  return b2bFilterSchema.parse(params);
}

/** A component's type key: its own type, or "base" / "other" by kind. */
export const componentTypeOf = (row: Pick<ComponentRow, "componentType" | "kind">): string =>
  row.componentType ?? (row.kind === "base" ? "base" : "other");

function componentMatches(row: ComponentRow, status: B2bFilters["status"]): boolean {
  switch (status) {
    case "low":
      return row.low;
    case "short":
      return row.available < 0;
    case "made":
      return row.madeToOrder;
    case "inactive":
      return !row.active;
    case "ok":
      return row.active && !row.low && !row.madeToOrder && row.available >= 0;
    default:
      return true;
  }
}

/** Searches, filters and sorts both B2B lists, and pages the products. */
export function filterB2b(overview: { components: ComponentRow[]; canMake: CanMakeRow[] }, filters: B2bFilters) {
  // Sorted by name first, so rows that tie on the chosen column stay A to Z.
  const byName = <T extends { name: string }>(rows: T[]) => sortRows(rows, { key: "name", dir: "asc" }, (row) => row.name);
  const q = filters.q?.toLowerCase();
  const components = sortRows(
    byName(overview.components).filter(
      (row) =>
        (!q || `${row.name} ${row.sku ?? ""}`.toLowerCase().includes(q)) &&
        (!filters.type || componentTypeOf(row) === filters.type) &&
        componentMatches(row, filters.status),
    ),
    filters.sort,
    (row, key) => (key === "type" ? (copy.componentTypes[componentTypeOf(row)] ?? componentTypeOf(row)) : row[key]),
  );

  const pq = filters.pq?.toLowerCase();
  const products = sortRows(
    byName(overview.canMake).filter((row) => {
      if (pq && !`${row.name} ${row.packSize}`.toLowerCase().includes(pq)) return false;
      switch (filters.recipe) {
        case "set":
          return row.lineCount > 0;
        case "none":
          return row.lineCount === 0;
        case "zero":
          return row.lineCount > 0 && row.makeable === 0;
        default:
          return true;
      }
    }),
    filters.psort,
    (row, key) => {
      if (key === "name") return row.name;
      if (key === "recipe") return row.lineCount;
      // No recipe sorts last; "no limit" counts as the most.
      if (row.lineCount === 0) return null;
      return row.makeable ?? Number.MAX_SAFE_INTEGER;
    },
  );
  const pageCount = Math.max(1, Math.ceil(products.length / INVENTORY_PAGE_SIZE));
  const page = Math.min(filters.ppage, pageCount);
  return {
    components,
    products: products.slice((page - 1) * INVENTORY_PAGE_SIZE, page * INVENTORY_PAGE_SIZE),
    productTotal: products.length,
    page,
    pageCount,
  };
}

export async function readRecipeEditor(productId: number) {
  const [product, components] = await Promise.all([
    db.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        packSize: true,
        brandEligible: true,
        brandMinQty: true,
        recipeLines: {
          orderBy: { id: "asc" },
          select: { componentId: true, quantity: true, component: { select: { name: true, unit: true, madeToOrder: true, onHand: true, reserved: true } } },
        },
      },
    }),
    db.stockItem.findMany({
      where: { kind: { in: ["packaging", "base"] }, active: true },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: { id: true, name: true, unit: true, kind: true },
    }),
  ]);
  if (!product) return null;
  const makeable = unitsMakeable(
    product.recipeLines.map((line) => ({
      componentId: line.componentId,
      quantity: line.quantity,
      madeToOrder: line.component.madeToOrder,
      available: line.component.onHand - line.component.reserved,
    })),
    product.brandMinQty ?? 1,
  );
  return { product, components, makeable };
}

// ─── Alerts (dashboard) ─────────────────────────────────────────────────────

export type StockAlerts = {
  lowFinished: { id: number; name: string; available: number }[];
  lowComponents: { id: number; name: string; available: number; unit: StockUnitKey }[];
  expiringBatches: number;
  expiredBatches: number;
};

/** Items at or below their alert level, and batches near or past expiry. */
export async function readStockAlerts(): Promise<StockAlerts> {
  const [items, batches] = await Promise.all([
    db.stockItem.findMany({
      where: { active: true, lowThreshold: { gt: 0 }, madeToOrder: false },
      select: { id: true, name: true, kind: true, unit: true, onHand: true, reserved: true, lowThreshold: true },
      orderBy: { name: "asc" },
    }),
    db.stockBatch.findMany({
      where: { qtyOnHand: { gt: 0 }, expiryDate: { not: null } },
      select: { expiryDate: true },
    }),
  ]);
  const low = items.filter((item) => item.onHand - item.reserved <= item.lowThreshold);
  return {
    lowFinished: low
      .filter((item) => item.kind === "finished")
      .map((item) => ({ id: item.id, name: item.name, available: Math.max(0, item.onHand - item.reserved) })),
    lowComponents: low
      .filter((item) => item.kind !== "finished")
      .map((item) => ({ id: item.id, name: item.name, available: item.onHand - item.reserved, unit: item.unit })),
    expiringBatches: batches.filter((batch) => expiryState(batch.expiryDate) === "soon").length,
    expiredBatches: batches.filter((batch) => expiryState(batch.expiryDate) === "expired").length,
  };
}

// ─── Actions ────────────────────────────────────────────────────────────────

export type ActionResult = { ok: true; message: string } | { ok: false; message?: string; fieldErrors?: Record<string, string> };

const stockMessages: Record<string, string> = {
  insufficient: errors.stock.insufficient,
  invalid_quantity: errors.quantity,
  reason_required: errors.reason,
  no_item: errors.stock.noItem,
  no_batch: errors.stock.noBatch,
  batch_clash: errors.stock.batchClash,
  below_reserved: errors.stock.belowReserved,
  not_expired: errors.stock.notExpired,
  nothing_to_write_off: errors.stock.nothingToWriteOff,
  batch_required: errors.stock.batchRequired,
};

function stockFailure(error: unknown): ActionResult {
  if (error instanceof StockError) return { ok: false, message: stockMessages[error.code] ?? errors.stock.insufficient };
  throw error;
}

const text = (max: number, message: string) => z.string({ error: message }).trim().min(1, message).max(max, message);
const optionalText = (max: number, message: string) =>
  z.preprocess(blankToNull, z.string({ error: message }).trim().max(max, message).nullable());

/** "2026-12-31" as a date (UTC midnight), or null when blank; undefined when not a date. */
function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === null || value === undefined || value.trim() === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return undefined;
  const date = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(+date) || date.toISOString().slice(0, 10) !== value.trim() ? undefined : date;
}

function rupeesToPaise(value: string | null): number | null | undefined {
  if (value === null || value.trim() === "") return null;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value.trim())) return undefined;
  return Math.round(Number(value.trim()) * 100);
}

async function unitOf(itemId: number): Promise<{ unit: StockUnitKey; kind: StockKind } | null> {
  return db.stockItem.findUnique({ where: { id: itemId }, select: { unit: true, kind: true } });
}

const idSchema = z.coerce.number().int().positive();

const receiveSchema = z.object({
  itemId: idSchema,
  quantity: text(20, errors.quantity),
  entryUnit: text(4, errors.quantity),
  batchNo: optionalText(60, errors.batchNo),
  mfgDate: z.preprocess(blankToNull, z.string().nullable()),
  expiryDate: z.preprocess(blankToNull, z.string().nullable()),
  unitCost: z.preprocess(blankToNull, z.string().nullable()),
  reason: optionalText(300, errors.reasonLong),
});

export async function receiveStockAction(raw: Record<string, string>, actorId: string): Promise<ActionResult> {
  const parsed = receiveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  const data = parsed.data;
  const item = await unitOf(data.itemId);
  if (!item) return { ok: false, message: errors.stock.noItem };
  const fieldErrors: Record<string, string> = {};
  const quantity = toBaseQuantity(data.quantity, data.entryUnit, item.unit);
  if (quantity === null || quantity <= 0) fieldErrors.quantity = errors.quantity;
  const mfgDate = parseDate(data.mfgDate);
  const expiryDate = parseDate(data.expiryDate);
  if (mfgDate === undefined) fieldErrors.mfgDate = errors.date;
  if (expiryDate === undefined) fieldErrors.expiryDate = errors.date;
  if (mfgDate && expiryDate && expiryDate < mfgDate) fieldErrors.expiryDate = errors.expiryBeforeMfg;
  const cost = rupeesToPaise(data.unitCost);
  if (cost === undefined) fieldErrors.unitCost = errors.cost;
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  if (item.kind === "finished" && expiryDate && daysToExpiry(expiryDate)! < 0) {
    return { ok: false, fieldErrors: { expiryDate: errors.expiredOnArrival } };
  }
  try {
    await db.$transaction((tx) =>
      receiveStock(tx, {
        itemId: data.itemId,
        quantity: quantity!,
        batchNo: data.batchNo,
        mfgDate: mfgDate ?? null,
        expiryDate: item.kind === "finished" ? (expiryDate ?? null) : null,
        unitCostPaise: cost ?? null,
        reason: data.reason,
        userId: actorId,
      }),
    );
  } catch (error) {
    return stockFailure(error);
  }
  return { ok: true, message: copy.messages.received };
}

const adjustSchema = z.object({
  itemId: idSchema,
  batchId: z.preprocess(blankToNull, idSchema.nullable()),
  direction: z.enum(["add", "remove"], { error: errors.quantity }),
  quantity: text(20, errors.quantity),
  entryUnit: text(4, errors.quantity),
  reason: text(300, errors.reason),
});

export async function adjustStockAction(raw: Record<string, string>, actorId: string): Promise<ActionResult> {
  const parsed = adjustSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  const data = parsed.data;
  const item = await unitOf(data.itemId);
  if (!item) return { ok: false, message: errors.stock.noItem };
  const amount = toBaseQuantity(data.quantity, data.entryUnit, item.unit);
  if (amount === null || amount <= 0) return { ok: false, fieldErrors: { quantity: errors.quantity } };
  try {
    await db.$transaction((tx) =>
      adjustStock(tx, {
        itemId: data.itemId,
        batchId: data.batchId,
        delta: data.direction === "add" ? amount : -amount,
        reason: data.reason,
        userId: actorId,
      }),
    );
  } catch (error) {
    if (error instanceof StockError && error.code === "batch_required") {
      return { ok: false, fieldErrors: { batchId: errors.stock.batchRequired } };
    }
    return stockFailure(error);
  }
  return { ok: true, message: copy.messages.adjusted };
}

export async function writeOffExpiredAction(rawBatchId: unknown, actorId: string): Promise<ActionResult> {
  const batchId = idSchema.safeParse(rawBatchId);
  if (!batchId.success) return { ok: false, message: errors.stock.noBatch };
  try {
    await db.$transaction((tx) => writeOffExpired(tx, { batchId: batchId.data, userId: actorId }));
  } catch (error) {
    return stockFailure(error);
  }
  return { ok: true, message: copy.messages.writtenOff };
}

// Settings of an item: the alert level, cost, and for components the details.

const settingsSchema = z.object({
  itemId: idSchema,
  lowThreshold: z.preprocess(blankToNull, z.string().nullable()),
  entryUnit: z.string().trim().max(4).default("pcs"),
  purchaseCost: z.preprocess(blankToNull, z.string().nullable()),
  madeToOrder: checkbox,
  active: z.preprocess((value) => value !== "off", z.boolean()),
  name: optionalText(160, errors.name),
  sku: optionalText(60, errors.sku),
  componentType: z.preprocess(blankToNull, z.enum(componentTypes, { error: errors.componentType }).nullable()),
  notes: optionalText(300, errors.notes),
});

export async function updateItemSettings(raw: Record<string, string>, actorId: string): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  const data = parsed.data;
  const item = await db.stockItem.findUnique({ where: { id: data.itemId } });
  if (!item) return { ok: false, message: errors.stock.noItem };
  const fieldErrors: Record<string, string> = {};
  const threshold = data.lowThreshold === null ? 0 : toBaseQuantity(data.lowThreshold, data.entryUnit, item.unit);
  if (threshold === null || threshold < 0) fieldErrors.lowThreshold = errors.threshold;
  const cost = rupeesToPaise(data.purchaseCost);
  if (cost === undefined) fieldErrors.purchaseCost = errors.cost;
  const isComponent = item.kind !== "finished";
  if (isComponent && !data.name) fieldErrors.name = errors.name;
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const next = {
    lowThreshold: threshold!,
    purchaseCostPaise: cost ?? null,
    ...(isComponent && {
      name: data.name!,
      sku: data.sku,
      componentType: data.componentType,
      notes: data.notes,
      madeToOrder: item.kind === "base" ? data.madeToOrder : false,
      active: data.active,
    }),
  };
  try {
    await db.$transaction(async (tx) => {
      await tx.stockItem.update({ where: { id: item.id }, data: next });
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [field, to] of Object.entries(next)) {
        const from = (item as Record<string, unknown>)[field];
        if (from !== to) changes[field] = { from: from === undefined ? null : (from as never), to: to as never };
      }
      if (Object.keys(changes).length > 0) {
        await logAdminAction(tx, { actorId, action: "inventory.item.update", resource: "StockItem", resourceId: item.id, changes });
      }
    });
  } catch (error) {
    if (isUniqueClash(error)) return { ok: false, fieldErrors: { sku: errors.skuTaken } };
    throw error;
  }
  return { ok: true, message: copy.messages.saved };
}

const componentSchema = z.object({
  kind: z.enum(["packaging", "base"], { error: errors.kind }),
  name: text(160, errors.name),
  sku: optionalText(60, errors.sku),
  unit: z.enum(stockUnits, { error: errors.unit }),
  componentType: z.preprocess(blankToNull, z.enum(componentTypes, { error: errors.componentType }).nullable()),
  lowThreshold: z.preprocess(blankToNull, z.string().nullable()),
  madeToOrder: checkbox,
});

export async function createComponent(
  raw: Record<string, string>,
  actorId: string,
): Promise<{ ok: true; id: number } | { ok: false; fieldErrors: Record<string, string> }> {
  const parsed = componentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  const data = parsed.data;
  const fieldErrors: Record<string, string> = {};
  if (data.kind === "packaging" && data.unit !== "pcs") fieldErrors.unit = errors.packagingUnit;
  const threshold = data.lowThreshold === null ? 0 : toBaseQuantity(data.lowThreshold, data.unit, data.unit);
  if (threshold === null || threshold < 0) fieldErrors.lowThreshold = errors.threshold;
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  try {
    return await db.$transaction(async (tx) => {
      const item = await tx.stockItem.create({
        data: {
          kind: data.kind,
          name: data.name,
          sku: data.sku,
          unit: data.unit,
          componentType: data.componentType ?? (data.kind === "base" ? "base" : "other"),
          lowThreshold: threshold!,
          madeToOrder: data.kind === "base" && data.madeToOrder,
        },
        select: { id: true },
      });
      await logAdminAction(tx, {
        actorId,
        action: "inventory.item.create",
        resource: "StockItem",
        resourceId: item.id,
        changes: { name: { from: null, to: data.name }, kind: { from: null, to: data.kind } },
      });
      return { ok: true as const, id: item.id };
    });
  } catch (error) {
    if (isUniqueClash(error)) return { ok: false, fieldErrors: { sku: errors.skuTaken } };
    throw error;
  }
}

function isUniqueClash(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

// Recipes ---------------------------------------------------------------

export const MAX_RECIPE_LINES = 20;

const recipeLineSchema = z.object({
  componentId: idSchema,
  quantity: z.number().int().min(1).max(1_000_000),
});

/** Reads the recipe form: `qty-<id>` for each line, `remove-<id>`, and one new line. */
export function parseRecipeForm(raw: Record<string, string>): { lines: { componentId: number; quantity: number }[] } | { fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const lines: { componentId: number; quantity: number }[] = [];
  for (const [name, value] of Object.entries(raw)) {
    const match = /^qty-(\d+)$/.exec(name);
    if (!match || raw[`remove-${match[1]}`] === "on") continue;
    const quantity = /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
    const line = recipeLineSchema.safeParse({ componentId: Number(match[1]), quantity });
    if (line.success) lines.push(line.data);
    else fieldErrors[name] = errors.recipeQuantity;
  }
  const newId = raw.newComponent?.trim();
  if (newId) {
    const quantity = /^\d+$/.test((raw.newQuantity ?? "").trim()) ? Number(raw.newQuantity.trim()) : NaN;
    const line = recipeLineSchema.safeParse({ componentId: Number(newId), quantity });
    if (!line.success) fieldErrors.newQuantity = errors.recipeQuantity;
    else if (lines.some((existing) => existing.componentId === line.data.componentId)) fieldErrors.newComponent = errors.recipeDuplicate;
    else lines.push(line.data);
  }
  if (lines.length > MAX_RECIPE_LINES) fieldErrors.newComponent = errors.recipeTooMany;
  return Object.keys(fieldErrors).length > 0 ? { fieldErrors } : { lines };
}

export async function saveRecipe(productId: number, raw: Record<string, string>, actorId: string): Promise<ActionResult> {
  const parsed = parseRecipeForm(raw);
  if ("fieldErrors" in parsed) return { ok: false, fieldErrors: parsed.fieldErrors };
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return { ok: false, message: errors.recipeNoProduct };
  const found = await db.stockItem.count({
    where: { id: { in: parsed.lines.map((line) => line.componentId) }, kind: { in: ["packaging", "base"] } },
  });
  if (found !== parsed.lines.length) return { ok: false, fieldErrors: { newComponent: errors.recipeComponent } };
  await db.$transaction(async (tx) => {
    const before = await tx.recipeLine.findMany({ where: { productId }, select: { componentId: true, quantity: true } });
    await tx.recipeLine.deleteMany({ where: { productId } });
    if (parsed.lines.length > 0) {
      await tx.recipeLine.createMany({ data: parsed.lines.map((line) => ({ productId, ...line })) });
    }
    const show = (lines: { componentId: number; quantity: number }[]) =>
      lines.map((line) => `${line.componentId}:${line.quantity}`).sort().join(",");
    await logAdminAction(tx, {
      actorId,
      action: "inventory.recipe.update",
      resource: "Product",
      resourceId: productId,
      changes: { recipe: { from: show(before), to: show(parsed.lines) } },
    });
  });
  return { ok: true, message: copy.messages.recipeSaved };
}

export { EXPIRY_WARN_DAYS, entryUnits };
