import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { deviceOf, isBotAgent, normalizeRoute } from "@/lib/error-scrub";
import { maxTrackedPathLength, sectionOf, type PageSection } from "@/lib/page-sections";
import { db } from "@/server/db";
import { authEnv } from "@/server/env";
import { bucketOf, bucketsBetween, istDay, type ReportRange } from "@/server/admin/reports";

// Traffic (/admin/traffic): page views on the public site.
//
// Kept light on purpose so it never slows the site: the browser sends one
// small request after a page has loaded, the server adds one row, and
// nothing here ever throws into a page. No cookie and no account id are
// stored. A visitor is a hash of IP + browser + day + the server secret, so
// "visitors" means people per day, and a hash can't be traced back.

/** Raw rows kept this many days; older days are added up into PageViewDaily first. */
export const rawRetentionDays = 90;
export const maxPageViewBytes = 2 * 1024;

export const pageViewSchema = z.object({
  path: z.string().min(1).max(1000),
});

export type PageViewOutcome = "recorded" | "ignored" | "rate-limited" | "invalid";

// A per-IP cap kept in memory (the site runs as one Node process), so
// counting a view doesn't also write a rate-limit row. It only stops one
// address from inflating the numbers; a lost count after a restart is fine.
const perIpWindowMs = 10 * 60 * 1000;
// Generous: many phones on one mobile network can share an IP.
export const perIpMax = 600;
const ipHits = new Map<string, { count: number; resetAt: number }>();

function allowIp(ip: string, now: number): boolean {
  if (ipHits.size > 10_000) {
    for (const [key, hit] of ipHits) if (hit.resetAt <= now) ipHits.delete(key);
    if (ipHits.size > 10_000) ipHits.clear();
  }
  const hit = ipHits.get(ip);
  if (!hit || hit.resetAt <= now) {
    ipHits.set(ip, { count: 1, resetAt: now + perIpWindowMs });
    return true;
  }
  hit.count += 1;
  return hit.count <= perIpMax;
}

/** For tests. */
export function resetPageViewLimits(): void {
  ipHits.clear();
}

/** The day's visitor id: no cookie, changes daily, can't be reversed. */
export function visitorOf(ip: string, userAgent: string, day: string): string {
  return createHash("sha256")
    .update(`${authEnv().BETTER_AUTH_SECRET}|${day}|${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

/** The path as stored: ids as ":id", no query, at most 191 characters. */
export function trackedPath(path: string): string {
  return normalizeRoute(path).slice(0, maxTrackedPathLength);
}

/**
 * Handles POST /api/page-views. Never throws. Admins, bots and pages that
 * aren't part of the public site are ignored.
 */
export async function handlePageView(
  input: {
    body: unknown;
    ip: string;
    userAgent: string | null;
    user: { role: string | null; userTypeId: number | null } | null;
  },
  now = new Date(),
): Promise<PageViewOutcome> {
  try {
    const parsed = pageViewSchema.safeParse(input.body);
    if (!parsed.success) return "invalid";
    const section = sectionOf(parsed.data.path);
    if (!section) return "ignored";
    if (isBotAgent(input.userAgent) || input.user?.role === "admin") return "ignored";
    if (!allowIp(input.ip, now.getTime())) return "rate-limited";

    const day = istDay(now);
    await db.pageView.create({
      data: {
        createdAt: now,
        day,
        path: trackedPath(parsed.data.path),
        section,
        userTypeId: input.user?.userTypeId ?? null,
        device: deviceOf(input.userAgent),
        visitor: visitorOf(input.ip, input.userAgent ?? "", day),
      },
    });
    // Now and then, fold old days into daily totals and delete their rows.
    if (Math.random() < 0.002) void rollUpOldPageViews(now);
    return "recorded";
  } catch (error) {
    console.error("[traffic] couldn't record a page view", error);
    return "ignored";
  }
}

// ---------------------------------------------------------------------------
// Adding up

type Kind = "total" | "section" | "path" | "audience" | "device";

const columnOf: Record<Exclude<Kind, "total">, string> = {
  section: "section",
  path: "path",
  // Signed-out visitors have no account type.
  audience: "COALESCE(CAST(userTypeId AS CHAR), 'guest')",
  device: "device",
};

type DayFigure = { day: string; kind: Kind; key: string; views: number; visitors: number };

/** Day-by-day figures from the raw rows for days in [from, to] (inclusive). */
async function rawFigures(from: string, to: string): Promise<DayFigure[]> {
  const figures: DayFigure[] = [];
  const totals = await db.$queryRaw<{ day: string; views: bigint | number; visitors: bigint | number }[]>`
    SELECT day, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors
    FROM PageView WHERE day >= ${from} AND day <= ${to}
    GROUP BY day`;
  for (const row of totals) {
    figures.push({ day: row.day, kind: "total", key: "all", views: Number(row.views), visitors: Number(row.visitors) });
  }
  for (const kind of ["section", "path", "audience", "device"] as const) {
    // The column names are fixed above, never from input.
    const rows = await db.$queryRawUnsafe<
      { day: string; k: string; views: bigint | number; visitors: bigint | number }[]
    >(
      `SELECT day, ${columnOf[kind]} AS k, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors
       FROM PageView WHERE day >= ? AND day <= ? GROUP BY day, k`,
      from,
      to,
    );
    for (const row of rows) {
      figures.push({ day: row.day, kind, key: String(row.k), views: Number(row.views), visitors: Number(row.visitors) });
    }
  }
  return figures;
}

const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 24 * 3600_000).toISOString().slice(0, 10);

/** The first day whose raw rows are still kept. */
export function rawCutoffDay(now = new Date()): string {
  return addDays(istDay(now), -(rawRetentionDays - 1));
}

/**
 * Adds up every day older than the raw retention into PageViewDaily, then
 * deletes those rows. Safe to run twice (totals are replaced, not added).
 * Returns how many rows were deleted. Never throws.
 */
export async function rollUpOldPageViews(now = new Date()): Promise<number> {
  try {
    const cutoff = rawCutoffDay(now);
    const oldest = await db.pageView.findFirst({
      where: { day: { lt: cutoff } },
      orderBy: { day: "asc" },
      select: { day: true },
    });
    if (!oldest) return 0;
    const lastOld = addDays(cutoff, -1);
    const figures = await rawFigures(oldest.day, lastOld);
    const days = [...new Set(figures.map((figure) => figure.day))];
    await db.$transaction([
      db.pageViewDaily.deleteMany({ where: { day: { in: days } } }),
      db.pageViewDaily.createMany({ data: figures }),
      db.pageView.deleteMany({ where: { day: { lt: cutoff } } }),
    ]);
    return figures.filter((figure) => figure.kind === "total").reduce((sum, figure) => sum + figure.views, 0);
  } catch (error) {
    console.error("[traffic] couldn't roll up old page views", error);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// The report

export type Count = { views: number; visitors: number };
export type KeyedCount = Count & { key: string };
export type TrafficBucket = Count & { key: string };

export type TrafficReport = {
  range: ReportRange;
  total: Count;
  /** Views by signed-in visitors. */
  signedInViews: number;
  buckets: TrafficBucket[];
  sections: (Count & { key: PageSection })[];
  /** The 25 most viewed pages. */
  pages: (KeyedCount & { section: PageSection | null })[];
  /** Account types (by name) and "guest". */
  audiences: (Count & { key: string; label: string | null })[];
  devices: KeyedCount[];
};

export const topPagesShown = 25;

function addTo(map: Map<string, Count>, key: string, figure: Count): void {
  const current = map.get(key) ?? { views: 0, visitors: 0 };
  current.views += figure.views;
  current.visitors += figure.visitors;
  map.set(key, current);
}

const sortByViews = <T extends Count & { key: string }>(rows: T[]) =>
  rows.sort((a, b) => b.views - a.views || b.visitors - a.visitors || a.key.localeCompare(b.key));

/**
 * Page views for a range. Visitors are people per day added up, so someone
 * who comes on three days counts three times (the hash changes daily).
 */
export async function readTraffic(range: ReportRange, now = new Date()): Promise<TrafficReport> {
  const cutoff = rawCutoffDay(now);
  const figures: DayFigure[] = [];
  if (range.to >= cutoff) {
    figures.push(...(await rawFigures(range.from > cutoff ? range.from : cutoff, range.to)));
  }
  if (range.from < cutoff) {
    const old = await db.pageViewDaily.findMany({
      where: { day: { gte: range.from, lte: range.to < cutoff ? range.to : addDays(cutoff, -1) } },
      select: { day: true, kind: true, key: true, views: true, visitors: true },
    });
    figures.push(...old.map((row) => ({ ...row, kind: row.kind as Kind })));
  }

  const byKind: Record<Kind, Map<string, Count>> = {
    total: new Map(),
    section: new Map(),
    path: new Map(),
    audience: new Map(),
    device: new Map(),
  };
  const buckets = new Map<string, Count>(bucketsBetween(range.from, range.to, range.by).map((key) => [key, { views: 0, visitors: 0 }]));
  for (const figure of figures) {
    addTo(byKind[figure.kind], figure.key, figure);
    if (figure.kind === "total") addTo(buckets, bucketOf(figure.day, range.by), figure);
  }

  const total = byKind.total.get("all") ?? { views: 0, visitors: 0 };
  const guestViews = byKind.audience.get("guest")?.views ?? 0;

  const typeIds = [...byKind.audience.keys()].filter((key) => key !== "guest").map(Number).filter(Number.isInteger);
  const types = typeIds.length
    ? await db.userType.findMany({ where: { id: { in: typeIds } }, select: { id: true, label: true } })
    : [];
  const typeLabel = new Map(types.map((type) => [String(type.id), type.label]));

  return {
    range,
    total,
    signedInViews: Math.max(0, total.views - guestViews),
    buckets: [...buckets].map(([key, count]) => ({ key, ...count })),
    sections: sortByViews(
      [...byKind.section].map(([key, count]) => ({ key: key as PageSection, ...count })),
    ),
    pages: sortByViews([...byKind.path].map(([key, count]) => ({ key, section: sectionOf(key), ...count }))).slice(
      0,
      topPagesShown,
    ),
    audiences: sortByViews(
      [...byKind.audience].map(([key, count]) => ({
        key,
        label: key === "guest" ? null : (typeLabel.get(key) ?? null),
        ...count,
      })),
    ),
    devices: sortByViews([...byKind.device].map(([key, count]) => ({ key, ...count }))),
  };
}
