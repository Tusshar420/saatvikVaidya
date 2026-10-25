import "server-only";
import { z } from "zod";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { orderStatuses } from "./orders";

// Admin reports (/admin/reports, docs/CHUNKS.md P1.10). Read-only. Money is
// summed in paise from the order rows and item snapshots, and coins from the
// ledger, so the numbers match invoices and balances exactly. Days are India
// days (the shop's day), whatever the server's time zone is.

/** Orders that count as sales: paid, and not cancelled, failed or returned. */
export const soldStatuses = [
  "paid",
  "processing",
  "shipped",
  "delivered",
] as const satisfies readonly OrderStatus[];

export const groupings = ["day", "week", "month"] as const;
export type Grouping = (typeof groupings)[number];

/** The longest range a report covers. */
export const MAX_RANGE_DAYS = 400;
const DEFAULT_RANGE_DAYS = 30;
const DAY_MS = 24 * 3600_000;
const IST_OFFSET_MS = 5.5 * 3600_000;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const isoDate = z.iso.date();

/** Invalid values are dropped, so a bad link still shows the page. */
export const reportFiltersSchema = z.object({
  from: z.preprocess(first, isoDate.optional()).catch(undefined),
  to: z.preprocess(first, isoDate.optional()).catch(undefined),
  by: z.preprocess(first, z.enum(groupings).optional()).catch(undefined),
});

export type ReportRange = { from: string; to: string; by: Grouping };

/** "YYYY-MM-DD" of the India day that `date` falls in. */
export function istDay(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

const istDayStart = (day: string) => new Date(`${day}T00:00:00+05:30`);
const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * The range to report on: the last 30 days up to today unless given. A "to"
 * before "from" is swapped, and the range is cut to MAX_RANGE_DAYS.
 */
export function resolveRange(
  filters: z.infer<typeof reportFiltersSchema>,
  now = new Date(),
): ReportRange {
  const today = istDay(now);
  let to = filters.to ?? today;
  let from = filters.from ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  if (from > to) [from, to] = [to, from];
  const earliest = addDays(to, -(MAX_RANGE_DAYS - 1));
  if (from < earliest) from = earliest;
  return { from, to, by: filters.by ?? "day" };
}

/** The window [from 00:00, to+1 00:00) in India time, for createdAt/paidAt. */
export function rangeWindow(range: Pick<ReportRange, "from" | "to">): { gte: Date; lt: Date } {
  return { gte: istDayStart(range.from), lt: istDayStart(addDays(range.to, 1)) };
}

/** The bucket a day falls in: the day, the Monday of its week, or "YYYY-MM". */
export function bucketOf(day: string, by: Grouping): string {
  if (by === "day") return day;
  if (by === "month") return day.slice(0, 7);
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

/** Every bucket from `from` to `to`, oldest first, so empty ones show as zero. */
export function bucketsBetween(from: string, to: string, by: Grouping): string[] {
  const keys: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const key = bucketOf(day, by);
    if (keys[keys.length - 1] !== key) keys.push(key);
  }
  return keys;
}

export type SalesBucket = { key: string; orders: number; paise: number };

export type SalesReport = {
  buckets: SalesBucket[];
  totalOrders: number;
  totalPaise: number;
};

export type StatusCount = { status: OrderStatus; count: number };

export type TopProduct = {
  slug: string;
  name: string;
  kind: "product" | "ebook" | "course";
  units: number;
  paise: number;
};

export type UserTypeCount = { key: string; label: string; count: number };

export type CoinsReport = {
  /** Earned on orders, profile rewards and admin credits. */
  issued: number;
  /** Spent at checkout, net of coins given back. */
  redeemed: number;
  /** Earnings reversed on cancelled orders, and admin debits. */
  takenBack: number;
};

export type Reports = {
  range: ReportRange;
  sales: SalesReport;
  ordersByStatus: StatusCount[];
  topProducts: TopProduct[];
  newUsers: { total: number; byType: UserTypeCount[] };
  pendingApprovals: number;
  coins: CoinsReport;
};

export const TOP_PRODUCTS = 10;

async function readSales(range: ReportRange): Promise<SalesReport> {
  const orders = await db.order.findMany({
    where: { status: { in: [...soldStatuses] }, paidAt: rangeWindow(range) },
    select: { paidAt: true, totalPaise: true },
  });
  const byKey = new Map(
    bucketsBetween(range.from, range.to, range.by).map((key) => [key, { key, orders: 0, paise: 0 }]),
  );
  let totalPaise = 0;
  for (const order of orders) {
    // paidAt is set for every sold order; the window already needs it.
    const bucket = byKey.get(bucketOf(istDay(order.paidAt as Date), range.by));
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.paise += order.totalPaise;
    totalPaise += order.totalPaise;
  }
  return { buckets: [...byKey.values()], totalOrders: orders.length, totalPaise };
}

async function readOrdersByStatus(range: ReportRange): Promise<StatusCount[]> {
  const rows = await db.order.groupBy({
    by: ["status"],
    where: { createdAt: rangeWindow(range) },
    _count: { _all: true },
  });
  const counts = new Map(rows.map((row) => [row.status, row._count._all]));
  return orderStatuses.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

async function readTopProducts(range: ReportRange): Promise<TopProduct[]> {
  const rows = await db.orderItem.groupBy({
    by: ["productSlug", "productName", "kind"],
    where: { order: { status: { in: [...soldStatuses] }, paidAt: rangeWindow(range) } },
    _sum: { quantity: true, lineTotalPaise: true, discountPaise: true },
    orderBy: [{ _sum: { quantity: "desc" } }, { productSlug: "asc" }],
    take: TOP_PRODUCTS,
  });
  return rows.map((row) => ({
    slug: row.productSlug,
    name: row.productName,
    kind: row.kind,
    units: row._sum.quantity ?? 0,
    // What the buyers paid for the item, after their coin discount.
    paise: (row._sum.lineTotalPaise ?? 0) - (row._sum.discountPaise ?? 0),
  }));
}

async function readNewUsers(range: ReportRange): Promise<Reports["newUsers"]> {
  const [types, rows] = await Promise.all([
    db.userType.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, key: true, label: true },
    }),
    db.user.groupBy({
      by: ["userTypeId"],
      where: { role: "user", createdAt: rangeWindow(range) },
      _count: { _all: true },
    }),
  ]);
  const counts = new Map(rows.map((row) => [row.userTypeId, row._count._all]));
  const byType = types.map((type) => ({
    key: type.key,
    label: type.label,
    count: counts.get(type.id) ?? 0,
  }));
  return { total: byType.reduce((sum, type) => sum + type.count, 0), byType };
}

async function sumCoins(where: Prisma.CoinLedgerWhereInput): Promise<number> {
  const result = await db.coinLedger.aggregate({ where, _sum: { amount: true } });
  return result._sum.amount ?? 0;
}

async function readCoins(range: ReportRange): Promise<CoinsReport> {
  const createdAt = rangeWindow(range);
  const [issued, redeemed, takenBack] = await Promise.all([
    sumCoins({
      createdAt,
      OR: [{ reason: { in: ["earn_order", "earn_profile"] } }, { reason: "admin_adjust", amount: { gt: 0 } }],
    }),
    sumCoins({ createdAt, reason: { in: ["redeem", "redeem_return"] } }),
    sumCoins({ createdAt, OR: [{ reason: "earn_reversal" }, { reason: "admin_adjust", amount: { lt: 0 } }] }),
  ]);
  // Debits are negative in the ledger; show them as positive amounts.
  // (0 - x rather than -x, so an empty sum is 0 and not -0.)
  return { issued, redeemed: 0 - redeemed, takenBack: 0 - takenBack };
}

export function countPendingApprovals(): Promise<number> {
  return db.user.count({
    where: { verificationStatus: "pending", userType: { requiresVerification: true } },
  });
}

/** Every report for the range. */
export async function readReports(range: ReportRange): Promise<Reports> {
  const [sales, ordersByStatus, topProducts, newUsers, pendingApprovals, coins] = await Promise.all([
    readSales(range),
    readOrdersByStatus(range),
    readTopProducts(range),
    readNewUsers(range),
    countPendingApprovals(),
    readCoins(range),
  ]);
  return { range, sales, ordersByStatus, topProducts, newUsers, pendingApprovals, coins };
}
