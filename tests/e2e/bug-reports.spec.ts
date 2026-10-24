import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { bugReportsAdmin, myReports, reportProblem as copy, reportStatusForUser } from "../../src/content/bug-reports";
import { errorLog } from "../../src/content/errors";
import { shell } from "../../src/content/shell";
import { signIn } from "../../src/content/sign-in";
import { e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// "Report a problem" (Phase 4): guests from the footer, signed-in users from
// the account menu, their list in My account, and the admin Reports tab.
// Every report carries a unique tag and is removed at the end.

// Headless Chrome says "HeadlessChrome", which the site treats as a bot (its
// reports are dropped), so these tests use an ordinary browser's user agent.
const agents = {
  phone:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
  desktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
};
test.use({
  userAgent: async ({}, provide, testInfo) => {
    await provide(testInfo.project.name.startsWith("phone") ? agents.phone : agents.desktop);
  },
});

// A tiny real PNG (1 × 1 pixel).
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await useFreshIp(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const tagOf = () => `e2e-report-${randomBytes(4).toString("hex")}`;

async function removeReports(tag: string) {
  const db = e2eDb();
  const reports = await db.bugReport.findMany({ where: { description: { contains: tag } }, select: { id: true } });
  const ids = reports.map((report) => report.id);
  await db.adminLog.deleteMany({ where: { resource: "BugReport", resourceId: { in: ids.map(String) } } });
  await db.bugReport.deleteMany({ where: { id: { in: ids } } });
  await db.errorGroup.deleteMany({ where: { message: { contains: tag } } });
}

/**
 * Leaves a promise rejection unhandled in the page (an error thrown from
 * evaluate() reaches window.onerror as a cross-origin "Script error.", which
 * the reporter drops as noise) and waits until the error log has it.
 */
async function causeBrowserError(page: Page, message: string) {
  // Retried: the page's error listener is attached only once React has hydrated.
  await expect(async () => {
    const sent = page.waitForResponse((response) => response.url().endsWith("/api/errors"), { timeout: 2000 });
    await page.evaluate((text) => {
      void Promise.reject(new Error(text));
    }, message);
    expect((await sent).status()).toBe(204);
  }).toPass({ timeout: 20_000 });
}

test("a guest reports a problem from the footer, with a screenshot, linked to the page's error", async ({ page }) => {
  const tag = tagOf();
  const db = e2eDb();
  try {
    await page.goto("/ebooks");
    await causeBrowserError(page, `Boom ${tag}`);

    await page.getByRole("contentinfo").getByRole("button", { name: copy.trigger }).click();
    const dialog = page.getByRole("dialog", { name: copy.title });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(copy.attached(false))).toBeVisible();

    // Too short first: the form says so and sends nothing.
    await dialog.getByLabel(copy.descriptionLabel).fill("broken");
    await dialog.getByRole("button", { name: copy.submit }).click();
    await expect(dialog.getByText(copy.tooShort(10))).toBeVisible();

    await dialog.getByLabel(copy.descriptionLabel).fill(`The ebook list went blank after I scrolled. ${tag}`);
    await dialog.getByLabel(copy.screenshotLabel).setInputFiles({ name: "screen.png", mimeType: "image/png", buffer: png });
    await dialog.getByLabel(copy.emailLabel).fill("guest-reporter@example.com");
    expect(await horizontalOverflow(page)).toBe(0);
    expect(await axeViolations(page)).toEqual([]);

    await dialog.getByRole("button", { name: copy.submit }).click();
    await expect(page.getByRole("dialog", { name: copy.thanks.title })).toBeVisible();
    await expect(page.getByText(copy.thanks.guest, { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: copy.thanks.myReports })).toHaveCount(0);

    const report = await db.bugReport.findFirstOrThrow({
      where: { description: { contains: tag } },
      include: { errors: { include: { group: true } } },
    });
    expect(report).toMatchObject({
      userId: null,
      contactEmail: "guest-reporter@example.com",
      screenshotType: "image/png",
      status: "new",
    });
    expect(report.pageUrl).toContain("/ebooks");
    expect(report.screenWidth).toBeGreaterThan(0);
    expect(report.viewportWidth).toBe(page.viewportSize()!.width);
    expect(report.device).toBe(test.info().project.name.startsWith("phone") ? "mobile" : "desktop");
    expect(report.errors.map((link) => link.group.message)).toEqual([`Boom ${tag}`]);
    expect(report.errors[0]!.auto).toBe(true);

    // The screenshot is private: a guest (no session) can't open it.
    expect((await page.request.get(`/api/bug-reports/${report.id}/screenshot`)).status()).toBe(404);

    // The text button (the corner X is also called "Close").
    await page.getByRole("dialog").locator("button", { hasText: copy.thanks.close }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    await removeReports(tag);
  }
});

test("a signed-in user reports from the account menu and follows the status in their account", async ({ page, baseURL, isMobile }) => {
  const tag = tagOf();
  const db = e2eDb();
  const errors = collectErrors(page);
  const { id: userId, name } = await signInAs(page, baseURL!, { role: "user" });
  try {
    await page.goto("/account/reports");
    await expect(page.getByRole("heading", { name: myReports.emptyTitle })).toBeVisible();

    if (isMobile) {
      // Phones have no account menu; the footer's link opens the same form.
      await page.getByRole("contentinfo").getByRole("button", { name: shell.footer.reportProblem }).click();
    } else {
      await page.getByRole("button", { name: signIn.menu.trigger(name) }).click();
      await page.getByRole("menuitem", { name: signIn.menu.reportProblem }).click();
    }
    const dialog = page.getByRole("dialog", { name: copy.title });
    await expect(dialog).toBeVisible();
    // Signed in: no email box, and the account is mentioned in what's attached.
    await expect(dialog.getByLabel(copy.emailLabel)).toHaveCount(0);
    await expect(dialog.getByText(copy.attached(true))).toBeVisible();
    await dialog.getByLabel(copy.descriptionLabel).fill(`My orders page shows the wrong total. ${tag}`);
    await dialog.getByRole("button", { name: copy.submit }).click();

    await page.getByRole("link", { name: copy.thanks.myReports }).click();
    await expect(page).toHaveURL(/\/account\/reports$/);
    const card = page.getByTestId("my-report");
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(tag);
    await expect(card).toContainText(reportStatusForUser.new);

    const report = await db.bugReport.findFirstOrThrow({ where: { description: { contains: tag } } });
    expect(report).toMatchObject({ userId, contactEmail: null });
    await db.bugReport.update({
      where: { id: report.id },
      data: { status: "investigating", adminNote: `Internal ${tag} note` },
    });
    await page.reload();
    await expect(card).toContainText(reportStatusForUser.investigating);
    await expect(page.getByText(`Internal ${tag} note`)).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBe(0);
    expect(await axeViolations(page)).toEqual([]);

    // My account links here.
    await page.goto("/account");
    await page.getByRole("link", { name: /Problem reports/ }).click();
    await expect(page).toHaveURL(/\/account\/reports$/);
    expect(errors).toEqual([]);
  } finally {
    await removeReports(tag);
  }
});

test("admins work through reports in the error log's Reports tab", async ({ page, baseURL }) => {
  const tag = tagOf();
  const db = e2eDb();
  const errors = collectErrors(page);
  const { id: adminId } = await signInAs(page, baseURL!, { role: "admin" });
  const autoGroup = await db.errorGroup.create({
    data: { fingerprint: `${tag}-auto`, source: "browser", message: `Auto ${tag}`, route: "/cart" },
  });
  const otherGroup = await db.errorGroup.create({
    data: { fingerprint: `${tag}-other`, source: "server", message: `Other ${tag}`, route: "/api/cart", method: "POST", statusCode: 500 },
  });
  const report = await db.bugReport.create({
    data: {
      description: `The cart button spins forever. ${tag}`,
      contactEmail: "someone@example.com",
      pageUrl: "http://localhost:3100/cart",
      userAgent: agents.phone,
      device: "mobile",
      screenWidth: 412,
      screenHeight: 915,
      viewportWidth: 412,
      viewportHeight: 800,
      pixelRatio: 2.625,
      sessionErrors: [{ message: `Auto ${tag}`, url: "http://localhost:3100/cart", kind: "error", at: new Date().toISOString() }],
      errors: { create: { groupId: autoGroup.id, auto: true } },
    },
  });
  try {
    await page.goto("/admin/errors");
    await page.getByRole("navigation", { name: bugReportsAdmin.tabs.label }).getByRole("link", { name: /Reports/ }).click();
    await expect(page).toHaveURL(/\/admin\/errors\/reports$/);
    await page.getByLabel(bugReportsAdmin.searchLabel).fill(tag);
    await page.getByRole("button", { name: "Filter" }).click();
    const rows = page.getByTestId("report-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(bugReportsAdmin.guest);
    await expect(rows.first()).toContainText(bugReportsAdmin.linkedCount(1));
    expect(await horizontalOverflow(page)).toBe(0);
    expect(await axeViolations(page)).toEqual([]);

    await rows.first().getByRole("link", { name: bugReportsAdmin.viewLabel(report.id) }).click();
    await expect(page.getByRole("heading", { name: bugReportsAdmin.detail.title(report.id), level: 1 })).toBeVisible();
    await expect(page.getByTestId("report-description")).toContainText(tag);
    await expect(page.getByText("Chrome 141 on Android")).toBeVisible();
    await expect(page.getByText(bugReportsAdmin.detail.screenValue(412, 915, 2.625))).toBeVisible();
    await expect(page.getByTestId("session-error")).toContainText(`Auto ${tag}`);
    await expect(page.getByTestId("linked-error")).toHaveCount(1);
    await expect(page.getByTestId("linked-error")).toContainText(bugReportsAdmin.detail.auto);
    expect(await horizontalOverflow(page)).toBe(0);
    expect(await axeViolations(page)).toEqual([]);

    // Status and internal note.
    await page.locator("#report-status-select").selectOption("investigating");
    await page.getByLabel(bugReportsAdmin.detail.noteLabel).fill(`Checking the cart API ${tag}`);
    await page.getByRole("button", { name: bugReportsAdmin.detail.save, exact: true }).click();
    await expect(page.getByText(bugReportsAdmin.detail.saved)).toBeVisible();
    await expect(page.getByText(errorLog.statuses.investigating).first()).toBeVisible();
    expect(await db.bugReport.findUniqueOrThrow({ where: { id: report.id } })).toMatchObject({
      status: "investigating",
      adminNote: `Checking the cart API ${tag}`,
    });

    // Link another error by pasting its link, then unlink the automatic one.
    await page.getByLabel(bugReportsAdmin.detail.linkLabel).fill(`${baseURL}/admin/errors/${otherGroup.id}`);
    const linkButton = page.getByRole("button", { name: bugReportsAdmin.detail.link, exact: true });
    await linkButton.click();
    await expect(page.getByText(bugReportsAdmin.detail.linkedNotice)).toBeVisible();
    await expect(page.getByTestId("linked-error")).toHaveCount(2);
    await page.getByLabel(bugReportsAdmin.detail.linkLabel).fill("999999999");
    await linkButton.click();
    await expect(page.getByText(bugReportsAdmin.detail.noError)).toBeVisible();
    await page.getByRole("button", { name: bugReportsAdmin.detail.unlinkLabel(autoGroup.id) }).click();
    await expect(page.getByText(bugReportsAdmin.detail.unlinkedNotice)).toBeVisible();
    await expect(page.getByTestId("linked-error")).toHaveCount(1);
    await expect(page.getByTestId("linked-error")).toContainText(`Other ${tag}`);
    expect(
      await db.adminLog.count({ where: { resource: "BugReport", resourceId: String(report.id), userId: adminId } }),
    ).toBe(3);

    // The error's own page lists the report.
    await page.goto(`/admin/errors/${otherGroup.id}`);
    await expect(page.getByTestId("error-report")).toContainText(tag);
    expect(errors).toEqual([]);
  } finally {
    await removeReports(tag);
  }
});

test("only error-log admins see reports and screenshots", async ({ page, baseURL }) => {
  await signInAs(page, baseURL!, { role: "admin", adminRole: "orders" });
  expect((await page.goto("/admin/errors/reports"))?.status()).toBe(404);
  expect((await page.request.get("/api/bug-reports/1/screenshot")).status()).toBe(404);
  // Cross-site posts are refused.
  const response = await page.request.post("/api/bug-reports", {
    headers: { origin: "https://evil.example" },
    multipart: { description: "Cross-site report attempt here" },
  });
  expect(response.status()).toBe(403);
});
