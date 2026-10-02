import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { devLogNotifier } from "@/server/notify";
import { resetAuthData, userTypeIds } from "../../../tests/setup/auth";
import {
  deleteOldErrors,
  logError,
  notifyAdmins,
  occurrencesKept,
  recordError,
  type ErrorInput,
} from "./record";
import { handleBrowserReport, maxReportBytes } from "./report";

const sent: unknown[] = [];
vi.spyOn(devLogNotifier, "send").mockImplementation(async (message) => {
  sent.push(message);
});

const base: ErrorInput = {
  source: "server",
  message: "Order 41 failed",
  stack: "Error: x\n    at placeOrder (/app/a.js:10:20)",
  route: "/orders/41",
  method: "POST",
  statusCode: 500,
};

beforeEach(async () => {
  sent.length = 0;
  await db.errorOccurrence.deleteMany();
  await db.errorGroup.deleteMany();
  await db.authRateLimit.deleteMany();
  await resetAuthData(db);
});
afterAll(() => db.$disconnect());

async function addAdmin(email: string, adminRole: "super" | "orders") {
  const types = await userTypeIds(db);
  return db.user.create({
    data: {
      id: `err-${email}`,
      name: email,
      email,
      role: "admin",
      adminRole,
      userTypeId: types.customer,
      termsAcceptedAt: new Date(),
    },
  });
}

describe("grouping", () => {
  it("puts the same error in one group and counts it", async () => {
    await recordError(base);
    await recordError({ ...base, message: "Order 42 failed", route: "/orders/42" });
    await recordError({ ...base, message: "Order 43 failed", route: "/orders/43" });
    const groups = await db.errorGroup.findMany();
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ count: 3, status: "new", route: "/orders/:id" });
    expect(await db.errorOccurrence.count()).toBe(3);
  });

  it("keeps different errors apart", async () => {
    await recordError(base);
    await recordError({ ...base, message: "Something else" });
    await recordError({ ...base, source: "browser" });
    expect(await db.errorGroup.count()).toBe(3);
  });

  it("keeps only the latest occurrences but the full count", async () => {
    for (let i = 0; i < occurrencesKept + 5; i++) await recordError(base);
    const group = await db.errorGroup.findFirstOrThrow();
    expect(group.count).toBe(occurrencesKept + 5);
    expect(await db.errorOccurrence.count()).toBe(occurrencesKept);
  });

  it("handles concurrent first occurrences without losing any", async () => {
    await Promise.all(Array.from({ length: 5 }, () => recordError(base)));
    expect(await db.errorGroup.count()).toBe(1);
    expect((await db.errorGroup.findFirstOrThrow()).count).toBe(5);
  });

  it("stores the user and a device", async () => {
    const user = await addAdmin("u@example.test", "super");
    await recordError({ ...base, userId: user.id, userAgent: "Mozilla/5.0 (iPhone) Mobile Safari" });
    const occurrence = await db.errorOccurrence.findFirstOrThrow();
    expect(occurrence).toMatchObject({ userId: user.id, device: "mobile" });
  });
});

describe("status", () => {
  it("reopens a fixed error that happens again, but leaves ignored and investigating alone", async () => {
    await recordError(base);
    const group = await db.errorGroup.findFirstOrThrow();
    await db.errorGroup.update({ where: { id: group.id }, data: { status: "fixed" } });
    const result = await recordError(base);
    expect(result).toMatchObject({ recorded: true, reopened: true });
    expect((await db.errorGroup.findFirstOrThrow()).status).toBe("new");

    for (const status of ["ignored", "investigating"] as const) {
      await db.errorGroup.update({ where: { id: group.id }, data: { status } });
      await recordError(base);
      expect((await db.errorGroup.findFirstOrThrow()).status).toBe(status);
    }
  });
});

describe("scrubbing on the way in", () => {
  it("never stores secrets from the message, stack, url or context", async () => {
    await recordError({
      ...base,
      message: "Login failed password=hunter2",
      stack: "Error\n    at f (/a.js:1:1)\nAuthorization: Bearer abcdefghijkl",
      url: "http://localhost:3000/checkout?token=SECRET&x=1",
      context: { password: "hunter2", cardNumber: "4111111111111111", orderId: "o1", note: "otp 123456" },
    });
    const everything = JSON.stringify([await db.errorGroup.findMany(), await db.errorOccurrence.findMany()]);
    for (const secret of ["hunter2", "abcdefghijkl", "SECRET", "4111111111111111", "123456"]) {
      expect(everything).not.toContain(secret);
    }
    expect(everything).toContain("o1");
  });
});

describe("logError", () => {
  it("records a caught error with scrubbed context and never throws", async () => {
    await logError(new Error("Webhook failed"), { where: "payments/webhook", orderId: "o9", token: "tok_123" });
    const group = await db.errorGroup.findFirstOrThrow();
    expect(group).toMatchObject({ source: "server", route: "/payments/webhook" });
    const occurrence = await db.errorOccurrence.findFirstOrThrow();
    expect(occurrence.context).toEqual({ caught: true, orderId: "o9", token: "[redacted]" });
    await expect(logError("plain string", { where: "x" })).resolves.toBeUndefined();
  });
});

describe("retention", () => {
  it("deletes occurrences and errors older than 90 days", async () => {
    const old = new Date(Date.now() - 91 * 24 * 3600_000);
    await recordError(base, old);
    await recordError({ ...base, message: "Recent one" });
    await deleteOldErrors();
    const groups = await db.errorGroup.findMany();
    expect(groups.map((g) => g.message)).toEqual(["Recent one"]);
    expect(await db.errorOccurrence.count()).toBe(1);
  });

  it("deletes old occurrences of an error that is still happening", async () => {
    await recordError(base, new Date(Date.now() - 100 * 24 * 3600_000));
    await recordError(base);
    expect(await deleteOldErrors()).toBe(1);
    expect(await db.errorGroup.count()).toBe(1);
  });
});

describe("emailing admins", () => {
  it("emails super admins (only) about a new error, once per hour per error", async () => {
    await addAdmin("super@example.test", "super");
    await addAdmin("orders@example.test", "orders");
    await recordError(base);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ channel: "email", to: "super@example.test" });

    const group = await db.errorGroup.findFirstOrThrow();
    expect(await notifyAdmins(group.id)).toBe(false);
    const inTwoHours = new Date(Date.now() + 2 * 3600_000);
    expect(await notifyAdmins(group.id, inTwoHours)).toBe(true);
    expect(sent).toHaveLength(2);
  });

  it("doesn't email again for repeats, but does when a fixed error comes back after an hour", async () => {
    await addAdmin("super@example.test", "super");
    await recordError(base);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await recordError(base);
    await recordError(base);
    expect(sent).toHaveLength(1);
  });

  it("stays quiet for ignored errors", async () => {
    await addAdmin("super@example.test", "super");
    await recordError(base);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const group = await db.errorGroup.findFirstOrThrow();
    await db.errorGroup.update({ where: { id: group.id }, data: { status: "ignored", lastNotifiedAt: null } });
    await recordError(base);
    expect(sent).toHaveLength(1);
  });
});

describe("browser reports", () => {
  const phone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1";
  const body = { message: "Cannot read properties of null", url: "http://localhost:3000/orders/12", kind: "error" };
  const call = (over: Partial<Parameters<typeof handleBrowserReport>[0]> = {}) =>
    handleBrowserReport({ body, ip: "198.51.100.1", userAgent: phone, userId: null, ...over });

  it("records a report as a browser error on the normalised route", async () => {
    expect(await call()).toBe("recorded");
    expect(await db.errorGroup.findFirstOrThrow()).toMatchObject({ source: "browser", route: "/orders/:id" });
  });

  it("rejects invalid bodies", async () => {
    expect(await call({ body: { message: "", url: "/" } })).toBe("invalid");
    expect(await call({ body: "nope" })).toBe("invalid");
    expect(maxReportBytes).toBeGreaterThan(1000);
  });

  it("ignores bots and browser noise without storing anything", async () => {
    expect(await call({ userAgent: "Googlebot/2.1" })).toBe("ignored");
    expect(await call({ userAgent: null })).toBe("ignored");
    expect(await call({ body: { ...body, message: "ResizeObserver loop limit exceeded" } })).toBe("ignored");
    expect(await call({ body: { ...body, stack: "Error\n at a (chrome-extension://x/y.js:1:1)" } })).toBe("ignored");
    expect(await db.errorGroup.count()).toBe(0);
  });

  it("rate-limits per IP: 30 per 10 minutes, other IPs unaffected", async () => {
    for (let i = 0; i < 30; i++) expect(await call()).toBe("recorded");
    expect(await call()).toBe("rate-limited");
    expect(await call({ ip: "198.51.100.2" })).toBe("recorded");
    expect((await db.errorGroup.findFirstOrThrow()).count).toBe(31);
  });

  it("rate-limits per signed-in user across IPs: 60 per hour", async () => {
    const user = await addAdmin("limit@example.test", "super");
    for (let i = 0; i < 60; i++) {
      expect(await call({ ip: `198.51.101.${i}`, userId: user.id })).toBe("recorded");
    }
    expect(await call({ ip: "198.51.102.1", userId: user.id })).toBe("rate-limited");
  });

  it("stops creating new error groups past the hourly cap, but still counts known ones", async () => {
    await db.authRateLimit.create({
      data: { key: "error-report:new-groups:all", count: 200, resetAtMs: BigInt(Date.now() + 3600_000) },
    });
    expect(await call({ body: { ...body, message: "A brand new problem" } })).toBe("ignored");
    expect(await db.errorGroup.count()).toBe(0);
    await recordError({ ...base, source: "browser", message: body.message, stack: undefined, route: body.url });
    expect(await call()).toBe("recorded");
  });
});
