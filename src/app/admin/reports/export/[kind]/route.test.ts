import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { clearAuthTables } from "../../../../../../tests/setup/content-db";
import { userTypeSeed } from "@/server/seed/user-types";

// Who may download the CSV exports: admins only, and each download is
// logged. The session is mocked (getSession() returns `session.user`).

const session = vi.hoisted(() => ({
  user: null as null | { id: string; role: "user" | "admin" },
}));
vi.mock("@/server/auth/session", () => ({
  getSession: vi.fn(async () => (session.user ? { user: session.user } : null)),
}));

const { GET } = await import("./route");

const admin = { id: "export-admin", role: "admin" as const };

beforeEach(async () => {
  await clearAuthTables(db);
  session.user = null;
  for (const type of userTypeSeed) {
    await db.userType.upsert({ where: { key: type.key }, create: type, update: type });
  }
  const customer = await db.userType.findUniqueOrThrow({ where: { key: "customer" } });
  for (const user of [admin, { id: "export-user", role: "user" as const }]) {
    await db.user.create({
      data: {
        ...user,
        name: user.id,
        email: `${user.id}@example.test`,
        userTypeId: customer.id,
        termsAcceptedAt: new Date(),
      },
    });
  }
});

afterAll(async () => {
  await db.$disconnect();
});

const download = (kind: string, query = "") =>
  GET(new NextRequest(`http://localhost:3000/admin/reports/export/${kind}${query}`), {
    params: Promise.resolve({ kind }),
  });

const logCount = () => db.adminLog.count({ where: { action: { in: ["export.orders", "export.users"] } } });

describe("CSV export access", () => {
  it("gives signed-out visitors a 404 and writes no log", async () => {
    expect((await download("orders")).status).toBe(404);
    expect((await download("users")).status).toBe(404);
    expect(await logCount()).toBe(0);
  });

  it("gives customers a 404 and writes no log", async () => {
    session.user = { id: "export-user", role: "user" };
    expect((await download("users")).status).toBe(404);
    expect(await logCount()).toBe(0);
  });

  it("gives admins the file as a download, and logs it", async () => {
    session.user = admin;
    const response = await download("users");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="saatvik-vaidya-users-.*\.csv"$/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    expect(body).toContain("export-user@example.test");
    const log = await db.adminLog.findFirstOrThrow({ where: { action: "export.users" } });
    expect(log.userId).toBe(admin.id);
  });

  it("refuses kinds that don't exist, and ignores bad dates", async () => {
    session.user = admin;
    expect((await download("passwords")).status).toBe(404);
    expect((await download("orders", "?from=not-a-date")).status).toBe(200);
  });
});
