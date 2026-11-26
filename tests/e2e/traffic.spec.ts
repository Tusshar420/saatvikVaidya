import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { traffic as copy } from "../../src/content/traffic";
import { E2E_CONTENT_PREFIX, e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Traffic (/admin/traffic): the site counts page views, and admins read them.
// Other specs browse the site at the same time, so these use their own page
// addresses ("/products/e2e-traffic-...") and remove them afterwards.

const istDay = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

test.beforeEach(async ({ page }) => {
  await useFreshIp(page);
});

test("opening a page counts a view, with the visitor's account type", async ({ page, baseURL }) => {
  const db = e2eDb();
  const path = `/products/${E2E_CONTENT_PREFIX}traffic-${randomBytes(4).toString("hex")}`;
  try {
    // A guest.
    await page.goto(path);
    await expect.poll(() => db.pageView.count({ where: { path } })).toBe(1);
    const guestView = await db.pageView.findFirstOrThrow({ where: { path } });
    expect(guestView).toMatchObject({ section: "shop", userTypeId: null, day: istDay() });

    // A signed-in doctor.
    await signInAs(page, baseURL!, { role: "user", userType: "doctor" });
    const doctor = await db.userType.findUniqueOrThrow({ where: { key: "doctor" } });
    await page.goto(path);
    await expect.poll(() => db.pageView.count({ where: { path, userTypeId: doctor.id } })).toBe(1);
  } finally {
    await db.pageView.deleteMany({ where: { path } });
  }
});

test("admins don't add views, and the endpoint refuses cross-site and bad requests", async ({ page, baseURL }) => {
  const db = e2eDb();
  const path = `/products/${E2E_CONTENT_PREFIX}traffic-${randomBytes(4).toString("hex")}`;
  try {
    const headers = { origin: baseURL! };
    expect((await page.request.post("/api/page-views", { headers: { origin: "https://evil.example" }, data: { path } })).status()).toBe(403);
    expect((await page.request.post("/api/page-views", { headers, data: { nope: 1 } })).status()).toBe(400);
    expect((await page.request.post("/api/page-views", { headers, data: { path: "/admin/orders" } })).status()).toBe(204);

    await signInAs(page, baseURL!, { role: "admin" });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await db.pageView.count({ where: { path } })).toBe(0);
  } finally {
    await db.pageView.deleteMany({ where: { path } });
  }
});

test("admins see views by module, page, account type and device", async ({ page, baseURL }) => {
  const errors = collectErrors(page);
  const db = e2eDb();
  const path = `/products/${E2E_CONTENT_PREFIX}traffic-${randomBytes(4).toString("hex")}`;
  const day = istDay();
  // Enough views to be in the top 25 whatever else the other specs opened.
  await db.pageView.createMany({
    data: Array.from({ length: 400 }, (_, i) => ({
      day,
      path,
      section: "shop",
      device: i % 4 === 0 ? "desktop" : "mobile",
      visitor: `e2e${String(i % 50).padStart(29, "0")}`,
    })),
  });
  try {
    await signInAs(page, baseURL!, { role: "admin" });
    await page.goto("/admin/traffic");
    await expect(page.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();

    const pages = page.getByRole("table", { name: copy.pages.title });
    const row = pages.getByRole("row").filter({ hasText: path });
    await expect(row).toBeVisible();
    await expect(row).toContainText(copy.sectionNames.shop);
    await expect(row).toContainText("400");
    await expect(page.getByRole("table", { name: copy.sections.title })).toContainText(copy.sectionNames.shop);
    await expect(page.getByRole("table", { name: copy.audiences.title })).toContainText(copy.audiences.guest);
    await expect(page.getByRole("table", { name: copy.devices.title })).toContainText(copy.devices.names.mobile!);

    // A period with nothing in it.
    await page.goto("/admin/traffic?from=2020-01-01&to=2020-01-31");
    await expect(page.getByRole("table", { name: copy.sections.title })).toContainText(copy.empty);

    // The admin menu links here.
    await page.goto("/admin");
    await page.getByRole("link", { name: copy.nav }).first().click();
    await expect(page).toHaveURL(/\/admin\/traffic$/);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await axeViolations(page)).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await db.pageView.deleteMany({ where: { path } });
  }
});
