import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { recordServerError } from "./server";

const request = {
  path: "/orders/41?token=SECRET",
  method: "POST",
  headers: { host: "localhost:3000", "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/120", cookie: "a=b", authorization: "Bearer zzz" },
};
const context = { routePath: "/orders/[id]", routeType: "action", renderSource: undefined };

beforeEach(async () => {
  await db.errorOccurrence.deleteMany();
  await db.errorGroup.deleteMany();
});
afterAll(() => db.$disconnect());

describe("recordServerError (onRequestError)", () => {
  it("records the error with the route pattern, method and scrubbed URL, and no headers", async () => {
    await recordServerError(Object.assign(new Error("boom"), { digest: "d123" }), request, context);
    await recordServerError(new Error("boom"), request, context);
    const group = await db.errorGroup.findFirstOrThrow({ include: { occurrences: true } });
    expect(group).toMatchObject({ source: "server", route: "/orders/[id]", method: "POST", statusCode: 500, count: 2 });
    const stored = JSON.stringify(group);
    expect(stored).not.toMatch(/SECRET|zzz|a=b/);
    expect(group.occurrences[0]?.context).toMatchObject({ routeType: "action" });
  });

  it("ignores redirects and not-found signals", async () => {
    await recordServerError(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/x;307;" }), request, context);
    await recordServerError(Object.assign(new Error("x"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }), request, context);
    expect(await db.errorGroup.count()).toBe(0);
  });

  it("copes with non-Error values", async () => {
    await recordServerError("a string", request, context);
    await recordServerError(undefined, request, context);
    expect(await db.errorGroup.count()).toBe(2);
  });
});
