import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { errorLog as copy, notFoundScreen } from "../../src/content/errors";
import { e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Error log (Phase 4): the browser endpoint and the admin pages. Errors are
// created with a unique message and removed at the end, because the log is
// shared with the other specs running at the same time.

const phoneAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";

test.beforeEach(async ({ page }) => {
  await useFreshIp(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("the browser endpoint records errors and refuses bad or cross-site requests", async ({ page, baseURL }) => {
  const message = `e2e endpoint ${randomBytes(4).toString("hex")} password=hunter2`;
  const headers = { origin: baseURL!, "user-agent": phoneAgent };
  const data = { message, url: `${baseURL}/orders/123?token=SECRET`, kind: "error" };
  const db = e2eDb();
  try {
    expect((await page.request.post("/api/errors", { headers, data })).status()).toBe(204);
    expect((await page.request.post("/api/errors", { headers, data })).status()).toBe(204);
    const group = await db.errorGroup.findFirstOrThrow({
      where: { message: { startsWith: "e2e endpoint" } },
      include: { occurrences: true },
    });
    expect(group).toMatchObject({ source: "browser", route: "/orders/:id", count: 2 });
    expect(JSON.stringify(group)).not.toMatch(/hunter2|SECRET/);

    expect((await page.request.post("/api/errors", { headers: { ...headers, origin: "https://evil.example" }, data })).status()).toBe(403);
    expect((await page.request.post("/api/errors", { headers, data: { nope: true } })).status()).toBe(400);
    // Bots get a quiet "ok" and nothing is stored.
    const botMessage = `e2e bot ${randomBytes(4).toString("hex")}`;
    expect(
      (await page.request.post("/api/errors", { headers: { ...headers, "user-agent": "Googlebot/2.1" }, data: { ...data, message: botMessage } })).status(),
    ).toBe(204);
    expect(await db.errorGroup.count({ where: { message: botMessage } })).toBe(0);
  } finally {
    await db.errorGroup.deleteMany({ where: { message: { startsWith: "e2e endpoint" } } });
  }
});

test("admins browse errors, filter them and move one through its statuses", async ({ page, baseURL }) => {
  const errors = collectErrors(page);
  const tag = randomBytes(4).toString("hex");
  const db = e2eDb();
  const { id: adminId } = await signInAs(page, baseURL!, { role: "admin" });
  const base = { stack: "Error: x\n    at f (/app/a.js:1:1)", firstSeenAt: new Date(), lastSeenAt: new Date() };
  const serverGroup = await db.errorGroup.create({
    data: { ...base, fingerprint: `e2e-${tag}-s`, source: "server", message: `E2E server ${tag}`, route: `/e2e-${tag}/:id`, method: "POST", statusCode: 500, count: 40 },
  });
  const browserGroup = await db.errorGroup.create({
    data: { ...base, fingerprint: `e2e-${tag}-b`, source: "browser", message: `E2E browser ${tag}`, route: `/e2e-${tag}`, count: 2 },
  });
  await db.errorOccurrence.create({
    data: { groupId: serverGroup.id, url: `/e2e-${tag}/5`, userId: adminId, device: "desktop", userAgent: "Chrome", context: { orderId: "o1" } },
  });
  try {
    await page.goto(`/admin/errors?q=${tag}&sort=frequent`);
    await expect(page.getByRole("heading", { name: copy.title, level: 1 })).toBeVisible();
    const rows = page.getByTestId("error-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText(`E2E server ${tag}`);
    await expect(rows.first()).toContainText("40");
    expect(await horizontalOverflow(page)).toBe(0);
    expect(await axeViolations(page)).toEqual([]);

    await page.goto(`/admin/errors?q=${tag}&source=browser`);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(`E2E browser ${tag}`);
    await page.goto(`/admin/errors?q=${tag}&status=fixed`);
    await expect(page.getByTestId("error-row")).toHaveCount(0);
    await page.goto(`/admin/errors?q=${tag}&route=/e2e-${tag}/`);
    await expect(rows).toHaveCount(1);

    await page.goto(`/admin/errors/${serverGroup.id}`);
    await expect(page.getByText(copy.happened(40))).toBeVisible();
    await expect(page.getByText("at f (/app/a.js:1:1)")).toBeVisible();
    await expect(page.getByTestId("occurrence")).toHaveCount(1);
    await expect(page.getByTestId("occurrence")).toContainText("E2E Admin");
    await expect(page.getByText(copy.detail.usersCount(1))).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
    expect(await axeViolations(page)).toEqual([]);

    await page.locator("#error-status-select").selectOption("investigating");
    await page.getByRole("button", { name: copy.detail.save }).click();
    await expect(page.getByText(copy.detail.saved)).toBeVisible();
    expect((await db.errorGroup.findUniqueOrThrow({ where: { id: serverGroup.id } })).status).toBe("investigating");
    expect(await db.adminLog.count({ where: { action: "error.status", resourceId: String(serverGroup.id) } })).toBe(1);

    await page.goto("/admin/errors/999999999");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(notFoundScreen.title);
    expect(errors.filter((message) => !/404/.test(message))).toEqual([]);
  } finally {
    await db.adminLog.deleteMany({ where: { action: "error.status", resourceId: { in: [String(serverGroup.id), String(browserGroup.id)] } } });
    await db.errorGroup.deleteMany({ where: { id: { in: [serverGroup.id, browserGroup.id] } } });
  }
});

test("only a super admin can open the error log", async ({ page, baseURL }) => {
  await signInAs(page, baseURL!, { role: "admin", adminRole: "orders" });
  expect((await page.goto("/admin/errors"))?.status()).toBe(404);
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: copy.nav })).toHaveCount(0);
});
