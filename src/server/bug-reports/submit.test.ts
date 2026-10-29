import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { recordError } from "@/server/errors/record";
import { getStorage } from "@/server/storage";
import { resetAuthData, userTypeIds } from "../../../tests/setup/auth";
import { findViewableScreenshot, listOwnReports } from "./reports";
import { errorsFromSession, submitBugReport } from "./submit";

const browser =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);

let ipCount = 0;
const nextIp = () => `198.51.110.${++ipCount}`;

function submit(fields: Record<string, unknown>, extra: Partial<Parameters<typeof submitBugReport>[0]> = {}) {
  return submitBugReport({
    fields: { description: "The pay button does nothing on the cart page.", ...fields },
    screenshot: null,
    ip: nextIp(),
    userAgent: browser,
    userId: null,
    ...extra,
  });
}

async function addUser(id: string) {
  const types = await userTypeIds(db);
  return db.user.create({
    data: { id, name: `User ${id}`, email: `${id}@example.com`, userTypeId: types.customer, termsAcceptedAt: new Date() },
  });
}

beforeEach(async () => {
  await db.bugReport.deleteMany();
  await db.errorOccurrence.deleteMany();
  await db.errorGroup.deleteMany();
  await db.authRateLimit.deleteMany();
  await resetAuthData(db);
});
afterAll(() => db.$disconnect());

describe("submitBugReport", () => {
  it("saves a guest report with what the page sent, scrubbed", async () => {
    const result = await submit({
      description: "Checkout broke after I typed password=hunter2 in the wrong box",
      contactEmail: "  guest@example.com ",
      pageUrl: "http://localhost:3000/checkout?token=SECRET&step=2",
      screenWidth: "390",
      screenHeight: "844",
      viewportWidth: "390",
      viewportHeight: "700",
      pixelRatio: "3",
    });
    expect(result).toMatchObject({ ok: true });
    const report = await db.bugReport.findFirstOrThrow();
    expect(report).toMatchObject({
      status: "new",
      userId: null,
      contactEmail: "guest@example.com",
      device: "mobile",
      screenWidth: 390,
      screenHeight: 844,
      viewportHeight: 700,
      pixelRatio: 3,
      screenshotKey: null,
    });
    expect(report.description).not.toContain("hunter2");
    expect(report.pageUrl).toContain("/checkout");
    expect(report.pageUrl).not.toContain("SECRET");
  });

  it("takes the reporter from the session and ignores a contact email from signed-in users", async () => {
    const user = await addUser("rep-signed-in");
    await submit({ contactEmail: "other@example.com" }, { userId: user.id });
    const report = await db.bugReport.findFirstOrThrow();
    expect(report).toMatchObject({ userId: user.id, contactEmail: null });
  });

  it("refuses too-short text and a bad email, and drops bad screen numbers", async () => {
    expect(await submit({ description: "broken" })).toEqual({ ok: false, error: "invalid" });
    expect(await submit({ contactEmail: "not-an-email" })).toEqual({ ok: false, error: "invalid" });
    expect(await submit({ screenWidth: "-5", pixelRatio: "lots" })).toMatchObject({ ok: true });
    expect(await db.bugReport.findFirstOrThrow()).toMatchObject({ screenWidth: null, pixelRatio: null });
  });

  it("quietly drops reports from bots and the honeypot", async () => {
    expect(await submit({ website: "http://spam.example" })).toEqual({ ok: true, reportId: null });
    expect(await submit({}, { userAgent: "Googlebot/2.1" })).toEqual({ ok: true, reportId: null });
    expect(await submit({}, { userAgent: null })).toEqual({ ok: true, reportId: null });
    expect(await db.bugReport.count()).toBe(0);
  });

  it("refuses guest reports full of links, but not signed-in ones", async () => {
    const links = "See http://a.example http://b.example www.c.example and https://d.example now";
    expect(await submit({ description: links })).toEqual({ ok: false, error: "tooManyLinks" });
    const user = await addUser("rep-links");
    expect(await submit({ description: links }, { userId: user.id })).toMatchObject({ ok: true });
  });

  it("rate-limits per IP (5 an hour) and per account (10 a day)", async () => {
    const ip = nextIp();
    for (let i = 0; i < 5; i++) expect(await submit({}, { ip })).toMatchObject({ ok: true });
    expect(await submit({}, { ip })).toMatchObject({ ok: false, error: "rateLimited" });
    expect(await submit({})).toMatchObject({ ok: true });

    const user = await addUser("rep-limit");
    for (let i = 0; i < 10; i++) expect(await submit({}, { userId: user.id })).toMatchObject({ ok: true });
    expect(await submit({}, { userId: user.id })).toMatchObject({ ok: false, error: "rateLimited" });
  });

  it("stores a real image screenshot privately and refuses other files", async () => {
    const user = await addUser("rep-shot");
    const other = await addUser("rep-other");
    const result = await submit({}, { userId: user.id, screenshot: png });
    if (!result.ok || !result.reportId) throw new Error("not saved");
    const report = await db.bugReport.findUniqueOrThrow({ where: { id: result.reportId } });
    expect(report.screenshotType).toBe("image/png");
    expect(report.screenshotKey).toMatch(/^bug-reports\/rep-shot\/[0-9a-f]{32}\.png$/);
    expect(await getStorage().get(report.screenshotKey!)).not.toBeNull();

    expect(await findViewableScreenshot(report.id, { id: user.id, isAdmin: false })).toMatchObject({
      contentType: "image/png",
    });
    expect(await findViewableScreenshot(report.id, { id: other.id, isAdmin: false })).toBeNull();
    expect(await findViewableScreenshot(report.id, { id: other.id, isAdmin: true })).not.toBeNull();

    expect(await submit({}, { screenshot: pdf })).toEqual({ ok: false, error: "fileType" });
    expect(await submit({}, { screenshot: new Uint8Array(5 * 1024 * 1024 + 1) })).toEqual({
      ok: false,
      error: "tooLarge",
    });
  });
});

describe("errors from the visit", () => {
  const pageUrl = "http://localhost:3000/orders/77?tab=items";
  const browserError = {
    message: "Cannot read properties of undefined (reading 'total')",
    stack: "TypeError: Cannot read properties of undefined\n    at OrderTotal (http://localhost:3000/_next/static/chunks/app.js:1:2)",
    url: pageUrl,
    kind: "error" as const,
    at: Date.now(),
  };

  it("links the report to the matching browser error and the server error behind an error screen", async () => {
    const recorded = await recordError({ source: "browser", message: browserError.message, stack: browserError.stack, route: pageUrl, url: pageUrl });
    const server = await recordError({
      source: "server",
      message: "DB timeout",
      route: "/orders/[id]",
      context: { digest: "12345678" },
    });
    const unrelated = await recordError({ source: "browser", message: "Something else", route: "/" });
    if (!recorded.recorded || !server.recorded || !unrelated.recorded) throw new Error("not recorded");

    const entries = [
      browserError,
      { message: "An error occurred in the Server Components render.", url: pageUrl, kind: "boundary", at: Date.now(), digest: "12345678" },
      { nonsense: true },
    ];
    const result = await submit({ sessionErrors: JSON.stringify(entries) });
    if (!result.ok || !result.reportId) throw new Error("not saved");
    const links = await db.bugReportError.findMany({ where: { reportId: result.reportId } });
    expect(links.map((link) => link.groupId).sort()).toEqual([recorded.groupId, server.groupId].sort());
    expect(links.every((link) => link.auto)).toBe(true);

    const report = await db.bugReport.findUniqueOrThrow({ where: { id: result.reportId } });
    const stored = report.sessionErrors as { message: string; url: string; digest?: string }[];
    expect(stored).toHaveLength(2);
    expect(stored[1]).toMatchObject({ digest: "12345678" });
    expect(JSON.stringify(stored)).not.toContain("stack");
  });

  it("ignores broken JSON and finds nothing for unknown errors", async () => {
    expect(await submit({ sessionErrors: "{not json" })).toMatchObject({ ok: true });
    expect(await errorsFromSession([{ ...browserError, message: "never recorded" }])).toEqual([]);
    expect(await db.bugReportError.count()).toBe(0);
  });
});

describe("listOwnReports", () => {
  it("shows a user only their own reports, without the admin note", async () => {
    const user = await addUser("rep-own");
    const other = await addUser("rep-own-other");
    await submit({ description: "Mine: the search box is stuck" }, { userId: user.id });
    await submit({ description: "Theirs: the cart is empty" }, { userId: other.id });
    await db.bugReport.updateMany({ where: { userId: user.id }, data: { adminNote: "secret note", status: "investigating" } });

    const reports = await listOwnReports(user.id);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ description: "Mine: the search box is stuck", status: "investigating", hasScreenshot: false });
    expect(JSON.stringify(reports)).not.toContain("secret note");
  });
});
