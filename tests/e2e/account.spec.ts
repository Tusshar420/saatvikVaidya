import { test, expect } from "@playwright/test";
import { account } from "../../src/content/account";
import { admin } from "../../src/content/admin";
import { checkout } from "../../src/content/checkout";
import { signIn } from "../../src/content/sign-in";
import { e2eDb, freshIp, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// My account (P1.10): name, password, email verification, notification
// preferences and saved addresses, then the admin reports and CSV export.
// Users are made by signInAs() and removed by tests/e2e/cleanup.ts.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const fields = checkout.address.fields;

test("a customer edits their name, changes their password and sets notification preferences", async ({
  page,
  baseURL,
}, testInfo) => {
  const errors = collectErrors(page);
  // Its own IP, so the change-password and email-link limits are its own.
  await useFreshIp(page);
  const user = await signInAs(page, baseURL!, { role: "user", name: "E2E Account Owner" });
  await e2eDb().user.update({ where: { id: user.id }, data: { emailVerified: false } });

  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E Account Owner");
  // Links to the rest of the signed-in area.
  const links = page.getByRole("navigation", { name: account.shortcuts.title });
  for (const link of [account.shortcuts.orders, account.shortcuts.coins, account.shortcuts.addresses]) {
    await expect(links.getByRole("link", { name: new RegExp(link.label) })).toBeVisible();
  }
  await expect(links.getByRole("link", { name: new RegExp(account.shortcuts.orders.label) })).toHaveAttribute(
    "href",
    "/orders",
  );
  await expect(links.getByRole("link", { name: new RegExp(account.shortcuts.admin.label) })).toHaveCount(0);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("account.png"), fullPage: true });

  // Name.
  const nameForm = page.getByRole("form", { name: account.nameForm.title });
  await nameForm.getByLabel(account.nameForm.label).fill("E2E Renamed Owner");
  await nameForm.getByRole("button", { name: account.nameForm.save }).click();
  await expect(nameForm.getByText(account.nameForm.saved)).toBeVisible();
  expect((await e2eDb().user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe("E2E Renamed Owner");
  await nameForm.getByLabel(account.nameForm.label).fill("A");
  await nameForm.getByRole("button", { name: account.nameForm.save }).click();
  await expect(nameForm.getByText(account.errors.name)).toBeVisible();

  // Email verification link (printed by the dev notifier).
  await page.getByRole("button", { name: account.emailVerify.send }).click();
  await expect(page.getByText(account.emailVerify.sent(user.email))).toBeVisible();

  // Notifications: untick SMS, keep email, tick offers.
  const prefs = page.getByRole("form", { name: account.notifications.title });
  await expect(prefs.getByLabel(account.notifications.orderEmail)).toBeChecked();
  await prefs.getByLabel(account.notifications.orderEmail).uncheck();
  await prefs.getByLabel(account.notifications.marketing).check();
  await prefs.getByRole("button", { name: account.notifications.save }).click();
  await expect(prefs.getByText(account.notifications.saved)).toBeVisible();
  expect(await e2eDb().user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
    notifyOrderEmail: false,
    marketingOptIn: true,
  });

  // Password: a wrong current one is refused, then it changes.
  const password = page.getByRole("form", { name: account.password.title });
  await password.getByLabel(account.password.current, { exact: true }).fill("not-my-password");
  await password.getByLabel(account.password.next, { exact: true }).fill("Brahmi-leaf-77-e2e");
  await password.getByRole("button", { name: account.password.save }).click();
  await expect(password.getByText(account.password.wrongCurrent)).toBeVisible();
  // The form clears after each try, so both fields are filled again.
  await password.getByLabel(account.password.current, { exact: true }).fill(user.password);
  await password.getByLabel(account.password.next, { exact: true }).fill("Brahmi-leaf-77-e2e");
  await password.getByRole("button", { name: account.password.save }).click();
  await expect(page.getByText(account.password.saved)).toBeVisible();
  const signIn = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: baseURL!, "x-forwarded-for": freshIp() },
    data: { email: user.email, password: "Brahmi-leaf-77-e2e" },
  });
  expect(signIn.status()).toBe(200);

  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("a customer adds, edits and deletes a saved address", async ({ page, baseURL }, testInfo) => {
  const errors = collectErrors(page);
  const user = await signInAs(page, baseURL!, { role: "user" });
  await page.goto("/account/addresses");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(account.addresses.title);
  await expect(page.getByText(account.addresses.empty)).toBeVisible();

  await page.getByRole("button", { name: account.addresses.add }).click();
  const form = page.getByRole("form", { name: checkout.address.formTitleNew });
  await form.getByLabel(fields.name).fill("Asha Rao");
  await form.getByLabel(fields.phone).fill("9876543210");
  await form.getByLabel(fields.line1).fill("Flat 4, Shanti Apartments");
  await form.getByLabel(fields.city).fill("Pune");
  await form.getByLabel(fields.state).selectOption({ label: "Maharashtra" });
  await form.getByLabel(fields.pincode).fill("411001");
  await form.getByRole("button", { name: checkout.address.save }).click();
  await expect(page.getByText(account.addresses.saved)).toBeVisible();
  await expect(page.getByText("Flat 4, Shanti Apartments")).toBeVisible();
  expect(await e2eDb().address.count({ where: { userId: user.id } })).toBe(1);
  // Closing the long form leaves the page scrolled down, which can park the
  // new card's buttons under the sticky header; axe would then read them as
  // obscured targets. Bring the saved address into view, as a user would.
  await page.getByText("Flat 4, Shanti Apartments").scrollIntoViewIfNeeded();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("addresses.png"), fullPage: true });

  // Edit.
  await page.getByRole("button", { name: account.addresses.editLabel("Asha Rao") }).click();
  const edit = page.getByRole("form", { name: checkout.address.formTitleEdit });
  await edit.getByLabel(fields.city).fill("Mumbai");
  await edit.getByLabel(fields.pincode).fill("400001");
  await edit.getByRole("button", { name: checkout.address.save }).click();
  await expect(page.getByText("Mumbai", { exact: false })).toBeVisible();
  expect(await e2eDb().address.findFirstOrThrow({ where: { userId: user.id } })).toMatchObject({
    city: "Mumbai",
    pincode: "400001",
  });

  // Delete, after confirming.
  await page.getByRole("button", { name: account.addresses.removeLabel("Asha Rao") }).click();
  await page.getByRole("button", { name: account.addresses.removeConfirm }).click();
  await expect(page.getByText(account.addresses.removed)).toBeVisible();
  await expect(page.getByText(account.addresses.empty)).toBeVisible();
  expect(await e2eDb().address.count({ where: { userId: user.id } })).toBe(0);
  expect(errors).toEqual([]);
});

test("an admin sees the reports and downloads a logged CSV; others can't", async ({ page, baseURL, browser, isMobile }, testInfo) => {
  const errors = collectErrors(page);
  const adminUser = await signInAs(page, baseURL!, { role: "admin" });

  // The account page links admins to the admin panel.
  await page.goto("/account");
  const adminLink = page
    .getByRole("navigation", { name: account.shortcuts.title })
    .getByRole("link", { name: new RegExp(account.shortcuts.admin.label) });
  await expect(adminLink).toHaveAttribute("href", "/admin");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("account-admin.png"), fullPage: true });
  await adminLink.click();
  await expect(page).toHaveURL(/\/admin$/);

  // So does the header's account menu (from 560 px; phones have the
  // account page's link above).
  if (!isMobile) {
    await page.goto("/account");
    await page
      .getByRole("banner")
      .getByRole("button", { name: signIn.menu.trigger(adminUser.name) })
      .click();
    await page.getByRole("menuitem", { name: signIn.menu.admin }).click();
    await expect(page).toHaveURL(/\/admin$/);
  }

  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(admin.reports.title);
  for (const heading of [
    admin.reports.sales.title,
    admin.reports.status.title,
    admin.reports.top.title,
    admin.reports.users.title,
    admin.reports.approvals.title,
    admin.reports.coins.title,
    admin.reports.export.title,
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  await page.screenshot({ path: testInfo.outputPath("reports.png"), fullPage: true });

  // A chosen period and grouping show in the form.
  await page.goto("/admin/reports?from=2026-01-01&to=2026-03-31&by=month");
  await expect(page.getByLabel(admin.reports.from)).toHaveValue("2026-01-01");
  await expect(page.getByLabel(admin.reports.by)).toHaveValue("month");

  // CSV: a real download, logged.
  const orders = await page.request.get("/admin/reports/export/orders");
  expect(orders.status()).toBe(200);
  expect(orders.headers()["content-type"]).toContain("text/csv");
  expect(await orders.text()).toContain("Order number");
  const users = await page.request.get("/admin/reports/export/users");
  expect(await users.text()).toContain(adminUser.email);
  const logged = await e2eDb().adminLog.findMany({
    where: { userId: adminUser.id, action: { in: ["export.orders", "export.users"] } },
  });
  expect(logged.map((row) => row.action).sort()).toEqual(["export.orders", "export.users"]);
  expect((await page.request.get("/admin/reports/export/secrets")).status()).toBe(404);

  // A customer gets a 404 for the page and the files, and nothing is logged.
  const customerContext = await browser.newContext({ baseURL: baseURL! });
  const customerPage = await customerContext.newPage();
  const customer = await signInAs(customerPage, baseURL!, { role: "user" });
  expect((await customerPage.request.get("/admin/reports/export/users")).status()).toBe(404);
  expect((await customerPage.goto("/admin/reports"))?.status()).toBe(404);
  expect(await e2eDb().adminLog.count({ where: { userId: customer.id } })).toBe(0);
  await customerContext.close();

  // Signed out: sent to sign-in.
  const guestContext = await browser.newContext({ baseURL: baseURL! });
  const guest = await guestContext.newPage();
  await guest.goto("/admin/reports");
  await expect(guest).toHaveURL(/sign-in|\/\?/);
  expect((await guestContext.request.get("/admin/reports/export/users", { maxRedirects: 0 })).status()).toBe(307);
  await guestContext.close();
  expect(errors).toEqual([]);
});
