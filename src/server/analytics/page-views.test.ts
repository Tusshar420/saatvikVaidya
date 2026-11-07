import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { resolveRange } from "@/server/admin/reports";
import { resetAuthData, userTypeIds } from "../../../tests/setup/auth";
import {
  handlePageView,
  perIpMax,
  rawCutoffDay,
  readTraffic,
  resetPageViewLimits,
  rollUpOldPageViews,
  visitorOf,
} from "./page-views";

const phoneAgent = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36";
const desktopAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/130 Safari/537.36";
const now = new Date("2026-11-07T10:00:00+05:30");

let types: Record<string, number>;

beforeEach(async () => {
  resetPageViewLimits();
  await db.pageView.deleteMany();
  await db.pageViewDaily.deleteMany();
  await resetAuthData(db);
  types = await userTypeIds(db);
});
afterAll(() => db.$disconnect());

function view(path: string, extra: Partial<Parameters<typeof handlePageView>[0]> = {}, at = now) {
  return handlePageView({ body: { path }, ip: "203.0.113.5", userAgent: phoneAgent, user: null, ...extra }, at);
}

describe("handlePageView", () => {
  it("stores the page, its module, the device and the day, with ids hidden", async () => {
    expect(await view("/orders/4123?tab=items")).toBe("recorded");
    const [row] = await db.pageView.findMany();
    expect(row).toMatchObject({ day: "2026-11-07", path: "/orders/:id", section: "orders", device: "mobile", userTypeId: null });
    expect(row?.visitor).toHaveLength(32);
    // Nothing that identifies the visitor is stored in the clear.
    expect(JSON.stringify(row)).not.toContain("203.0.113.5");
  });

  it("keeps the account type of signed-in visitors", async () => {
    await view("/courses", { user: { role: "user", userTypeId: types.doctor! } });
    expect((await db.pageView.findFirstOrThrow()).userTypeId).toBe(types.doctor);
  });

  it("ignores admins, bots, admin pages and unknown addresses", async () => {
    expect(await view("/courses", { user: { role: "admin", userTypeId: types.customer! } })).toBe("ignored");
    expect(await view("/courses", { userAgent: "Googlebot/2.1 (+http://www.google.com/bot.html)" })).toBe("ignored");
    expect(await view("/courses", { userAgent: null })).toBe("ignored");
    expect(await view("/admin/orders")).toBe("ignored");
    expect(await view("/wp-login.php")).toBe("ignored");
    expect(await db.pageView.count()).toBe(0);
  });

  it("refuses bad input", async () => {
    expect(await handlePageView({ body: { path: 5 }, ip: "1", userAgent: phoneAgent, user: null }, now)).toBe("invalid");
    expect(await handlePageView({ body: null, ip: "1", userAgent: phoneAgent, user: null }, now)).toBe("invalid");
    expect(await view("x".repeat(1001))).toBe("invalid");
  });

  it("caps how many views one address can add", async () => {
    for (let i = 0; i < perIpMax; i++) expect(await view("/")).toBe("recorded");
    expect(await view("/")).toBe("rate-limited");
    expect(await view("/", { ip: "198.51.100.9" })).toBe("recorded");
  });
});

describe("visitorOf", () => {
  it("is the same within a day and different the next day", () => {
    const today = visitorOf("203.0.113.5", phoneAgent, "2026-11-07");
    expect(visitorOf("203.0.113.5", phoneAgent, "2026-11-07")).toBe(today);
    expect(visitorOf("203.0.113.5", phoneAgent, "2026-11-08")).not.toBe(today);
    expect(visitorOf("203.0.113.6", phoneAgent, "2026-11-07")).not.toBe(today);
  });
});

describe("readTraffic", () => {
  it("counts views and daily visitors by module, page, account type and device", async () => {
    const doctor = { role: "user", userTypeId: types.doctor! };
    await view("/");
    await view("/courses");
    await view("/courses/7");
    await view("/courses", { ip: "198.51.100.1", userAgent: desktopAgent, user: doctor });
    // The same phone visitor the next day counts again as a visitor.
    await view("/courses", {}, new Date("2026-11-06T10:00:00+05:30"));

    const report = await readTraffic(resolveRange({ from: "2026-11-01", to: "2026-11-07" }, now), now);
    expect(report.total).toEqual({ views: 5, visitors: 3 });
    expect(report.signedInViews).toBe(1);
    expect(report.sections).toEqual([
      { key: "courses", views: 4, visitors: 3 },
      { key: "home", views: 1, visitors: 1 },
    ]);
    expect(report.pages[0]).toEqual({ key: "/courses", section: "courses", views: 3, visitors: 3 });
    expect(report.pages.find((page) => page.key === "/courses/:id")?.views).toBe(1);
    const guest = report.audiences.find((row) => row.key === "guest");
    expect(guest).toMatchObject({ views: 4, visitors: 2, label: null });
    expect(report.audiences.find((row) => row.key === String(types.doctor))?.label).toBeTruthy();
    expect(report.devices.map((row) => [row.key, row.views])).toEqual([
      ["mobile", 4],
      ["desktop", 1],
    ]);
    expect(report.buckets).toHaveLength(7);
    expect(report.buckets.at(-1)).toEqual({ key: "2026-11-07", views: 4, visitors: 2 });
    expect(report.buckets.at(-2)).toEqual({ key: "2026-11-06", views: 1, visitors: 1 });
  });

  it("is empty with no views", async () => {
    const report = await readTraffic(resolveRange({}, now), now);
    expect(report.total).toEqual({ views: 0, visitors: 0 });
    expect(report.sections).toEqual([]);
    expect(report.buckets).toHaveLength(30);
  });
});

describe("rollUpOldPageViews", () => {
  it("turns old days into daily totals, deletes their rows, and the report reads both", async () => {
    const old = new Date("2026-07-01T10:00:00+05:30");
    expect(rawCutoffDay(now) > "2026-07-01").toBe(true);
    await view("/quiz", {}, old);
    await view("/quiz/3", {}, old);
    await view("/quiz", { ip: "198.51.100.2" }, old);
    await view("/");

    expect(await rollUpOldPageViews(now)).toBe(3);
    expect(await db.pageView.count()).toBe(1);
    // Running it again changes nothing.
    expect(await rollUpOldPageViews(now)).toBe(0);
    expect(await db.pageViewDaily.findUnique({ where: { day_kind_key: { day: "2026-07-01", kind: "total", key: "all" } } }))
      .toMatchObject({ views: 3, visitors: 2 });

    const report = await readTraffic(resolveRange({ from: "2026-06-30", to: "2026-11-07", by: "month" }, now), now);
    expect(report.total).toEqual({ views: 4, visitors: 3 });
    expect(report.sections).toEqual([
      { key: "quiz", views: 3, visitors: 2 },
      { key: "home", views: 1, visitors: 1 },
    ]);
    expect(report.buckets.find((bucket) => bucket.key === "2026-07")).toEqual({ key: "2026-07", views: 3, visitors: 2 });
  });
});
