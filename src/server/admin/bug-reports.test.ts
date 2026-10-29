import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { resetAuthData, userTypeIds } from "../../../tests/setup/auth";
import {
  errorReference,
  linkReportToError,
  listReports,
  reportFiltersSchema,
  reportsForError,
  unlinkReportFromError,
  updateReport,
} from "./bug-reports";

let adminId = "";

beforeEach(async () => {
  await db.bugReport.deleteMany();
  await db.errorGroup.deleteMany();
  await db.adminLog.deleteMany({ where: { resource: "BugReport" } });
  await resetAuthData(db);
  const types = await userTypeIds(db);
  adminId = (
    await db.user.create({
      data: {
        id: "rep-admin",
        name: "Report Admin",
        email: "rep-admin@example.com",
        role: "admin",
        adminRole: "super",
        userTypeId: types.customer,
        termsAcceptedAt: new Date(),
      },
    })
  ).id;
});
afterAll(() => db.$disconnect());

const addReport = (description: string, createdAt = new Date()) =>
  db.bugReport.create({ data: { description, createdAt } });
const addError = (fingerprint: string) =>
  db.errorGroup.create({ data: { fingerprint, source: "browser", message: `Error ${fingerprint}`, route: "/" } });

describe("updateReport", () => {
  it("saves status and note and records only what changed", async () => {
    const report = await addReport("The page is blank");
    expect(await updateReport(adminId, report.id, { status: "investigating", adminNote: "Looking at the logs" })).toBe(true);
    expect(await db.bugReport.findUniqueOrThrow({ where: { id: report.id } })).toMatchObject({
      status: "investigating",
      adminNote: "Looking at the logs",
    });
    // Saving the same values again writes no log row; an empty note is stored as none.
    await updateReport(adminId, report.id, { status: "investigating", adminNote: "Looking at the logs" });
    await updateReport(adminId, report.id, { status: "fixed", adminNote: "" });
    const logs = await db.adminLog.findMany({ where: { action: "report.update" }, orderBy: { id: "asc" } });
    expect(logs).toHaveLength(2);
    expect(logs[1]!.changes).toMatchObject({ status: { from: "investigating", to: "fixed" }, adminNote: { from: "Looking at the logs", to: null } });
    expect(await updateReport(adminId, 999_999, { status: "fixed", adminNote: "" })).toBe(false);
  });
});

describe("linking reports and errors", () => {
  it("links by hand once, unlinks, and logs both", async () => {
    const report = await addReport("Search gives an error");
    const group = await addError("link-a");
    expect(await linkReportToError(adminId, report.id, group.id)).toBe("linked");
    expect(await linkReportToError(adminId, report.id, group.id)).toBe("already");
    expect(await linkReportToError(adminId, report.id, 999_999)).toBe("noError");
    expect(await linkReportToError(adminId, 999_999, group.id)).toBe("noReport");
    expect(await db.bugReportError.findFirstOrThrow()).toMatchObject({ auto: false });
    expect((await reportsForError(group.id)).map((r) => r.id)).toEqual([report.id]);

    expect(await unlinkReportFromError(adminId, report.id, group.id)).toBe(true);
    expect(await unlinkReportFromError(adminId, report.id, group.id)).toBe(false);
    expect(await db.adminLog.count({ where: { action: { in: ["report.link", "report.unlink"] } } })).toBe(2);
  });

  it("reads an error number or a pasted link to the error", () => {
    expect(errorReference.parse("42")).toBe(42);
    expect(errorReference.parse(" #42 ")).toBe(42);
    expect(errorReference.parse("http://localhost:3000/admin/errors/42")).toBe(42);
    expect(errorReference.parse("/admin/errors/42/")).toBe(42);
    expect(errorReference.safeParse("/admin/users/42").success).toBe(false);
    expect(errorReference.safeParse("forty-two").success).toBe(false);
  });
});

describe("listReports", () => {
  it("filters by text, status and date, newest first, with link counts", async () => {
    const old = await addReport("Old: the cart page was slow", new Date("2026-09-01T10:00:00+05:30"));
    const recent = await addReport("Recent: the cart total is wrong", new Date("2026-10-02T10:00:00+05:30"));
    await addReport("Recent: login loops");
    await db.bugReport.update({ where: { id: recent.id }, data: { status: "fixed" } });
    const group = await addError("count-a");
    await db.bugReportError.create({ data: { reportId: recent.id, groupId: group.id, auto: true } });

    const all = await listReports(reportFiltersSchema.parse({}));
    expect(all.total).toBe(3);
    const cart = await listReports(reportFiltersSchema.parse({ q: "cart" }));
    expect(cart.reports.map((r) => r.id)).toEqual([recent.id, old.id]);
    expect(cart.reports[0]!._count.errors).toBe(1);
    expect((await listReports(reportFiltersSchema.parse({ status: "fixed" }))).total).toBe(1);
    expect((await listReports(reportFiltersSchema.parse({ to: "2026-09-30" }))).reports.map((r) => r.id)).toEqual([old.id]);
    // Junk in the URL means no filter, not an error page.
    expect((await listReports(reportFiltersSchema.parse({ status: "nope", page: "x" }))).total).toBe(3);
  });
});
