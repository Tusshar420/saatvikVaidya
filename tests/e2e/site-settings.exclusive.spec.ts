import { randomInt } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { adminHome, adminSettings, homeKinds } from "../../src/content/admin-site";
import { admin } from "../../src/content/admin";
import { checkoutOff, maintenance } from "../../src/content/maintenance";
import { settingDefaults } from "../../src/content/settings";
import { E2E_CONTENT_PREFIX, signInAs } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Site settings, maintenance mode and homepage editing (P1.9), end to end.
// These change site-wide settings, so the file runs in the "-exclusive"
// projects, after all the other tests (see playwright.config.ts). Every test
// puts back what it changed through the same admin forms; leftovers from a
// stopped run are cleared by tests/e2e/cleanup.ts.

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const g = adminSettings.groups;

const formOf = (page: Page, title: string) =>
  page.locator("form").filter({ has: page.getByRole("group", { name: title }) });

async function save(page: Page, title: string) {
  const form = formOf(page, title);
  await form.getByRole("button", { name: adminSettings.save }).click();
  await expect(form.getByText(adminSettings.saved)).toBeVisible();
}

test("settings: editing the footer text and the announcement bar shows on the site", async ({ page, baseURL }) => {
  const errors = collectErrors(page);
  await signInAs(page, baseURL!, { role: "admin" });
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(adminSettings.title);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  const tagline = `E2E tagline ${randomInt(100_000)}`;
  const contact = formOf(page, g.contact.title);
  await contact.getByLabel(g.contact.footerTagline).fill(tagline);
  // A bad phone number is refused and nothing is saved.
  await contact.getByLabel(g.contact.phone).fill("12345");
  await contact.getByRole("button", { name: adminSettings.save }).click();
  await expect(contact.getByText(adminSettings.errors.phone)).toBeVisible();
  await contact.getByLabel(g.contact.phone).fill(settingDefaults["contact.phone"]);
  await save(page, g.contact.title);

  const bar = formOf(page, g.announcement.title);
  await bar.getByLabel(g.announcement.enabled).check();
  await bar.getByLabel(g.announcement.text).fill("E2E announcement");
  await bar.getByLabel(g.announcement.href).fill("/coins");
  await save(page, g.announcement.title);

  await page.goto("/");
  await expect(page.getByRole("contentinfo")).toContainText(tagline);
  const region = page.getByRole("region", { name: "Announcement" });
  await expect(region.getByRole("link", { name: "E2E announcement" })).toHaveAttribute("href", "/coins");
  expect(await axeViolations(page)).toEqual([]);

  // The change is in the history list.
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: adminSettings.historyTitle })).toBeVisible();
  await expect(page.getByText("footer.tagline").first()).toBeVisible();

  // Put both back.
  await formOf(page, g.contact.title).getByLabel(g.contact.footerTagline).fill(settingDefaults["footer.tagline"]);
  await save(page, g.contact.title);
  await formOf(page, g.announcement.title).getByLabel(g.announcement.enabled).uncheck();
  await save(page, g.announcement.title);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Announcement" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("maintenance mode blocks visitors and signed-in customers, not admins, and sign-in keeps working", async ({
  page,
  browser,
  baseURL,
  viewport,
  isMobile,
  hasTouch,
}) => {
  await signInAs(page, baseURL!, { role: "admin" });
  const switches = () => formOf(page, g.switches.title);
  try {
    await page.goto("/admin/settings");
    await switches().getByLabel(g.switches.maintenance).check();
    await switches().getByLabel(g.switches.maintenanceMessage).fill("E2E maintenance message");
    await save(page, g.switches.title);

    // A visitor sees the branded page on every public path, with sign-in still reachable.
    const visitor = await browser.newContext({ baseURL, viewport, isMobile, hasTouch });
    const guest = await visitor.newPage();
    for (const path of ["/", "/products", "/coins"]) {
      await guest.goto(path);
      await expect(guest.getByRole("heading", { level: 1 })).toContainText(maintenance.title);
      await expect(guest.getByText("E2E maintenance message")).toBeVisible();
    }
    await expect(guest.getByRole("button", { name: maintenance.adminSignIn })).toBeVisible();
    expect(await horizontalOverflow(guest)).toBeLessThanOrEqual(0);
    expect(await axeViolations(guest)).toEqual([]);
    // /api/auth is untouched, so an admin can sign in.
    expect((await guest.request.get("/api/auth/get-session")).status()).toBe(200);
    // A signed-in customer is blocked too.
    const customer = await visitor.newPage();
    await signInAs(customer, baseURL!, { role: "user" });
    await customer.goto("/");
    await expect(customer.getByRole("heading", { level: 1 })).toContainText(maintenance.title);
    await visitor.close();

    // The admin still sees the whole site, and the admin area.
    await page.goto("/");
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByText("E2E maintenance message")).toHaveCount(0);
  } finally {
    await page.goto("/admin/settings");
    await switches().getByLabel(g.switches.maintenance).uncheck();
    await save(page, g.switches.title);
  }
  await page.goto("/");
  await expect(page.getByText("E2E maintenance message")).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toBeVisible();
});

test("checkout switch: off shows a notice instead of the checkout form", async ({ page, baseURL }) => {
  const admin1 = await signInAs(page, baseURL!, { role: "admin" });
  expect(admin1.id).toBeTruthy();
  const switches = () => formOf(page, g.switches.title);
  try {
    await page.goto("/admin/settings");
    await switches().getByLabel(g.switches.checkout, { exact: true }).uncheck();
    await save(page, g.switches.title);
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(checkoutOff.title);
    await expect(page.getByRole("link", { name: checkoutOff.backToCart })).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  } finally {
    await page.goto("/admin/settings");
    await switches().getByLabel(g.switches.checkout, { exact: true }).check();
    await save(page, g.switches.title);
  }
});

test("homepage editing: a new offer shows on the homepage and a hidden section disappears", async ({
  page,
  baseURL,
}) => {
  await signInAs(page, baseURL!, { role: "admin" });
  const token = `${Date.now().toString(36)}${randomInt(10_000)}`;
  const title = `E2E offer ${token}`;

  await page.goto("/admin/content/offers");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Offers");
  expect(await axeViolations(page)).toEqual([]);
  await page.getByRole("link", { name: adminHome.add("offer") }).click();
  await page.getByLabel(admin.common.key, { exact: true }).fill(`${E2E_CONTENT_PREFIX}offer-${token}`);
  await page.getByLabel("Icon text").fill("★");
  await page.getByLabel("Eyebrow", { exact: true }).fill("E2E");
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Text", { exact: true }).fill("Made by the P1.9 e2e test.");
  await page.getByLabel("Link label", { exact: true }).fill("See it");
  await page.getByLabel("Show on the site").check();
  await page.getByRole("button", { name: admin.common.create }).click();
  await expect(page.getByText(admin.common.notices.created)).toBeVisible();

  await page.goto("/");
  await expect(page.getByText(title).first()).toBeVisible();

  // Edit it: the new title shows.
  await page.goto("/admin/content/offers");
  await page.getByRole("link", { name: `${admin.common.edit} ${title}` }).click();
  await page.getByLabel("Title", { exact: true }).fill(`${title} edited`);
  await page.getByRole("button", { name: admin.common.save }).click();
  await expect(page.getByText(admin.common.notices.saved)).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(`${title} edited`).first()).toBeVisible();

  // Sections: switch "Why Saatvik" off and it leaves the page; then back on.
  const why = adminHome.sections.labels.why;
  const sectionRow = () => page.getByRole("row", { name: new RegExp(why) });
  await page.goto("/admin/content/sections");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  await sectionRow().getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: adminHome.sections.save }).click();
  await expect(page.getByText(adminHome.sections.saved)).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Ayurveda practice journey.")).toHaveCount(0);
  await page.goto("/admin/content/sections");
  await sectionRow().getByRole("checkbox").check();
  await page.getByRole("button", { name: adminHome.sections.save }).click();
  await expect(page.getByText(adminHome.sections.saved)).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Ayurveda practice journey.").first()).toBeVisible();

  // Delete the offer again.
  await page.goto("/admin/content/offers");
  await page.getByRole("button", { name: `${admin.common.delete} ${title} edited` }).click();
  await page
    .getByRole("dialog", { name: admin.common.confirmDelete.title(`${title} edited`) })
    .getByRole("button", { name: admin.common.confirmDelete.confirm })
    .click();
  await expect(page.getByText(admin.common.notices.deleted)).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(`${title} edited`)).toHaveCount(0);
});

test("homepage editing: every content list opens, and a hero slide saves unchanged", async ({ page, baseURL }) => {
  await signInAs(page, baseURL!, { role: "admin" });
  for (const kind of Object.values(homeKinds)) {
    await page.goto(`/admin/content/${kind.path}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(kind.plural);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await axeViolations(page)).toEqual([]);
  }
  // The hero panel is JSON; saving a slide without touching it must be accepted.
  await page.goto("/admin/content/hero");
  await page.getByRole("link", { name: new RegExp(`^${admin.common.edit} `) }).first().click();
  await expect(page.getByLabel("Panel content")).not.toHaveValue("");
  expect(await axeViolations(page)).toEqual([]);
  await page.getByRole("button", { name: admin.common.save }).click();
  await expect(page.getByText(admin.common.notices.saved)).toBeVisible();
  // Bad JSON is refused with a message.
  await page.getByRole("link", { name: new RegExp(`^${admin.common.edit} `) }).first().click();
  await page.getByLabel("Panel content").fill("{ not json");
  await page.getByRole("button", { name: admin.common.save }).click();
  await expect(page.getByText(adminHome.jsonError)).toBeVisible();
});
