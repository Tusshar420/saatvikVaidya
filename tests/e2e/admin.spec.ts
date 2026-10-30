import { randomInt } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { admin as copy } from "../../src/content/admin";
import {
  createPendingProfessional,
  e2eDb,
  E2E_CONTENT_PREFIX,
  E2E_QUIZ_PREFIX,
  signInAs,
} from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// The admin panel (P1.1) on phone and desktop. Everything a test creates is
// marked (e2e emails, "e2e-" keys, "E2E " quiz titles) and removed by
// tests/e2e/cleanup.ts. New content is saved hidden so it never shows on the
// homepage while other tests run.

const token = () => `${Date.now().toString(36)}${randomInt(1000)}`;

const main = (page: Page) => page.locator("#admin-main");
const heading = (page: Page) => main(page).getByRole("heading", { level: 1 });

/** No sideways scroll, no WCAG A/AA problems, no console errors. */
async function expectClean(page: Page, errors: string[]) {
  expect(await horizontalOverflow(page)).toBe(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
}

test.describe("signed out", () => {
  for (const path of ["/admin", "/admin/users", "/admin/content/reels"]) {
    test(`${path} redirects to sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/\?auth=sign-in&next=/);
    });
  }

  test("the table data API is a 404", async ({ request }) => {
    const response = await request.get("/api/admin/tables/User");
    expect(response.status()).toBe(404);
  });
});

test("a signed-in customer gets a 404 on every admin page", async ({
  page,
  baseURL,
}) => {
  await signInAs(page, baseURL!, { role: "user" });
  for (const path of [
    "/admin",
    "/admin/users",
    "/admin/users/new",
    "/admin/approvals",
    "/admin/approvals/detail/anyone",
    "/admin/content/reels",
    "/admin/content/quiz/new",
    "/admin/orders",
    "/admin/database",
    "/admin/tables/Account",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.locator("#admin-main")).toHaveCount(0);
  }
  const api = await page.request.get("/api/admin/tables/User");
  expect(api.status()).toBe(404);
});

test.describe("as an admin", () => {
  let adminName: string;

  test.beforeEach(async ({ page, baseURL }) => {
    ({ name: adminName } = await signInAs(page, baseURL!, { role: "admin" }));
  });

  test("dashboard shows the summary and every section in the nav", async ({
    page,
    isMobile,
  }) => {
    const errors = collectErrors(page);
    await page.goto("/admin");
    await expect(heading(page)).toHaveText(copy.dashboard.title);
    for (const label of [
      copy.dashboard.stats.users,
      copy.dashboard.stats.pending,
      copy.dashboard.stats.orders,
    ]) {
      await expect(main(page).getByText(label, { exact: true })).toBeVisible();
    }
    const nav = page.getByRole("navigation", { name: copy.nav.label }).filter({
      visible: true,
    });
    await expect(nav).toHaveCount(1);
    for (const label of [
      copy.nav.users,
      copy.nav.approvals,
      copy.nav.reels,
      copy.nav.brands,
      copy.nav.courses,
      copy.nav.quiz,
      copy.nav.orders,
      copy.nav.settings,
    ]) {
      // Starts with the label: "Approvals" carries a count, and "Orders"
      // mustn't match "Brand orders" (P2.1).
      const name = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
      await expect(nav.getByRole("link", { name })).toHaveCount(1);
    }
    await expect(
      nav.getByRole("link", { name: copy.nav.dashboard }),
    ).toHaveAttribute("aria-current", "page");
    if (!isMobile) {
      await expect(
        page.getByRole("banner").getByText(adminName, { exact: true }),
      ).toBeVisible();
    }
    await expectClean(page, errors);
  });

  test("the search console finds a page and opens it", async ({ page, isMobile }) => {
    const errors = collectErrors(page);
    await page.goto("/admin");
    await expect(heading(page)).toHaveText(copy.dashboard.title);
    if (!isMobile) {
      // The sidebar shows its categories.
      const sidebar = page.locator("aside");
      for (const label of [copy.nav.groups.sales, copy.nav.groups.system]) {
        await expect(sidebar.getByText(label, { exact: true })).toBeVisible();
      }
    }
    await page
      .getByRole("button", { name: copy.console.button })
      .filter({ visible: true })
      .click();
    const dialog = page.getByRole("dialog", { name: copy.console.title });
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole("combobox");
    await expect(input).toBeFocused();
    await input.fill("stock");
    await expect(dialog.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    await input.fill("zzzz-none");
    await expect(dialog.getByText(copy.console.empty("zzzz-none"))).toBeVisible();
    await input.fill("orders");
    await expect(dialog.getByRole("option").first()).toContainText(copy.nav.orders);
    await expect(axeViolations(page)).resolves.toEqual([]);
    await input.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(heading(page)).toHaveText(copy.orders.title);

    // The keyboard shortcut opens it too; a typed admin address is offered.
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox").fill("/admin/settings");
    await dialog.getByRole("option", { name: copy.console.goTo("/admin/settings") }).click();
    await expect(page).toHaveURL(/\/admin\/settings$/);
    await expectClean(page, errors);
  });

  test("every admin page loads cleanly", async ({ page }) => {
    test.slow();
    const errors = collectErrors(page);
    const pages: [string, string][] = [
      ["/admin/users", copy.users.title],
      ["/admin/users/new", copy.userForm.newTitle],
      ["/admin/approvals", copy.approvals.title],
      ["/admin/content/reels", copy.reels.title],
      ["/admin/content/reels/new", copy.reels.newTitle],
      ["/admin/content/brands", copy.brands.title],
      ["/admin/content/brands/new", copy.brands.newTitle],
      ["/admin/content/courses", copy.courses.title],
      ["/admin/content/courses/new", copy.courses.newTitle],
      ["/admin/content/quiz", copy.quiz.title],
      ["/admin/content/quiz/new", copy.quiz.newTitle],
      ["/admin/orders", copy.orders.title],
      ["/admin/settings", copy.settings.title],
      ["/admin/database", copy.database.title],
    ];
    for (const [path, title] of pages) {
      await page.goto(path);
      await expect(heading(page), path).toHaveText(title);
      expect(await horizontalOverflow(page), path).toBe(0);
      expect(await axeViolations(page), path).toEqual([]);
    }
    expect(errors).toEqual([]);
  });

  test("users: add, view, edit and find a user", async ({ page }) => {
    const name = `E2E Vaidya ${token()}`;
    const email = `${token()}@e2e.saatvikvaidya.test`;

    await page.goto("/admin/users");
    await main(page).getByRole("link", { name: copy.users.add }).click();
    await expect(heading(page)).toHaveText(copy.userForm.newTitle);

    // An empty form explains what's missing.
    await main(page).getByRole("button", { name: copy.userForm.submitNew }).click();
    await expect(main(page).getByRole("alert")).toContainText(
      copy.common.formError,
    );
    await expect(main(page).getByLabel(copy.userForm.name)).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    await main(page).getByLabel(copy.userForm.name).fill(name);
    await main(page).getByLabel(copy.userForm.email).fill(email);
    await main(page)
      .getByLabel(copy.userForm.userType)
      .selectOption({ label: "Ayurveda Doctor" });
    await main(page).getByRole("button", { name: copy.userForm.submitNew }).click();

    await expect(heading(page)).toHaveText(name);
    await expect(main(page).getByRole("status")).toContainText(
      copy.common.notices.created,
    );
    // A new professional starts as pending.
    await expect(
      main(page).getByText(copy.users.status.pending, { exact: true }),
    ).toBeVisible();

    await main(page).getByRole("link", { name: copy.userDetail.edit }).click();
    await main(page).getByLabel(copy.userForm.name).fill(`${name} Edited`);
    await main(page).getByRole("button", { name: copy.userForm.submitEdit }).click();
    await expect(heading(page)).toHaveText(`${name} Edited`);
    await expect(main(page).getByRole("status")).toContainText(
      copy.common.notices.saved,
    );
    // The edit is in the user's history.
    await expect(
      main(page).getByText(copy.activity.actions["user.update"]),
    ).toBeVisible();

    await page.goto("/admin/users");
    await page.getByRole("searchbox").fill(email);
    await main(page).getByRole("button", { name: copy.common.filter }).click();
    await expect(page).toHaveURL(/q=/);
    await expect(main(page).getByRole("link", { name: `${name} Edited` })).toBeVisible();
    await expect(main(page).getByRole("row")).toHaveCount(2); // header + 1
  });

  test("users: bulk approve, reject and delete with confirmation", async ({
    page,
  }) => {
    const tag = token();
    const one = `E2E Bulk ${tag} One`;
    const two = `E2E Bulk ${tag} Two`;
    const ids = [
      await createPendingProfessional(one),
      await createPendingProfessional(two, "pharmacy"),
    ];

    const statusCells = (label: string) =>
      main(page).getByRole("table").getByText(label, { exact: true });

    await page.goto(`/admin/users?q=${encodeURIComponent(`E2E Bulk ${tag}`)}`);
    await expect(main(page).getByRole("link", { name: one })).toBeVisible();
    await main(page).getByLabel(copy.users.selectAll).check();
    await expect(main(page).getByText(copy.users.selected(2))).toBeVisible();

    // Approve, with a note.
    await main(page).getByRole("button", { name: copy.users.bulk.approve }).click();
    const dialog = page.getByRole("dialog", {
      name: copy.users.bulk.confirmTitle.approve(2),
    });
    await dialog.getByLabel(copy.users.bulk.noteLabel).fill("Licences seen");
    await dialog.getByRole("button", { name: copy.users.bulk.approve }).click();
    await expect(main(page).getByRole("status")).toContainText(
      copy.users.bulk.done.approve(2, 0),
    );
    await expect(statusCells(copy.users.status.approved)).toHaveCount(2);
    const logs = await e2eDb().adminLog.findMany({
      where: { action: "user.approve", resourceId: { in: ids } },
    });
    expect(logs).toHaveLength(2);
    expect(logs[0].changes).toMatchObject({ note: "Licences seen" });

    // Reject, cancelling first: nothing changes until confirmed.
    await main(page).getByLabel(copy.users.selectAll).check();
    await main(page).getByRole("button", { name: copy.users.bulk.reject }).click();
    await page.getByRole("dialog").getByRole("button", { name: copy.common.cancel }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(statusCells(copy.users.status.approved)).toHaveCount(2);
    await main(page).getByRole("button", { name: copy.users.bulk.reject }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: copy.users.bulk.reject })
      .click();
    await expect(statusCells(copy.users.status.rejected)).toHaveCount(2);

    // Delete.
    await main(page).getByLabel(copy.users.selectAll).check();
    await main(page).getByRole("button", { name: copy.users.bulk.delete }).click();
    await page
      .getByRole("dialog", { name: copy.users.bulk.confirmTitle.delete(2) })
      .getByRole("button", { name: copy.users.bulk.delete })
      .click();
    await expect(main(page).getByRole("status")).toContainText(
      copy.users.bulk.done.delete(2, 0),
    );
    await expect(main(page).getByRole("link", { name: one })).toHaveCount(0);
    expect(await e2eDb().user.count({ where: { id: { in: ids } } })).toBe(0);
  });

  test("approvals: approve one account with a comment", async ({ page }) => {
    const name = `E2E Approve ${token()}`;
    const id = await createPendingProfessional(name, "clinic");

    await page.goto("/admin/approvals");
    await expect(heading(page)).toHaveText(copy.approvals.title);
    await main(page).getByLabel(copy.approvals.commentLabel(name)).fill("Registration verified");
    await main(page)
      .getByRole("button", { name: copy.approvals.approveNamed(name) })
      .click();

    await expect(page.getByText(copy.userDetail.decide.approved).first()).toBeVisible();
    await expect(main(page).getByRole("link", { name: copy.approvals.viewNamed(name) })).toHaveCount(0);
    const user = await e2eDb().user.findUniqueOrThrow({ where: { id } });
    expect(user.verificationStatus).toBe("approved");
    const log = await e2eDb().adminLog.findFirstOrThrow({
      where: { action: "user.approve", resourceId: id },
    });
    expect(log.changes).toMatchObject({ note: "Registration verified" });
  });

  test("reels: add with a preview, edit and delete", async ({ page }) => {
    const key = `${E2E_CONTENT_PREFIX}reel-${token()}`;
    const title = `E2E reel ${key}`;

    await page.goto("/admin/content/reels/new");
    const form = main(page);
    await form.getByLabel(copy.common.key, { exact: true }).fill(key);
    await form.getByLabel(copy.reels.form.title).fill(title);
    await form.getByLabel(copy.reels.form.mediaKind).selectOption("IMAGE");
    await form.getByLabel(copy.reels.form.mediaSrc).fill("/media/saatvik-rewards.jpg");
    await form.getByLabel(copy.reels.form.mediaLabel).fill("Rewards poster");
    const preview = page.getByRole("complementary", { name: copy.reels.form.preview });
    await expect(preview.getByRole("img", { name: "Rewards poster" })).toBeVisible();

    // An off-site link is refused.
    await form.getByLabel(copy.common.linkLabel).fill("See rewards");
    await form.getByLabel(copy.common.linkHref).fill("https://evil.example");
    await form.getByRole("button", { name: copy.reels.add }).click();
    await expect(form.getByText(copy.reels.errors.link)).toBeVisible();
    // What was typed is still there.
    await expect(form.getByLabel(copy.reels.form.title)).toHaveValue(title);

    await form.getByLabel(copy.common.linkHref).fill("/coins");
    await form.getByRole("button", { name: copy.reels.add }).click();
    await expect(heading(page)).toHaveText(copy.reels.title);
    await expect(main(page).getByRole("status")).toContainText(copy.common.notices.created);
    const row = main(page).getByRole("row").filter({ hasText: title });
    await expect(row).toContainText(copy.common.hidden);

    await row.getByRole("link", { name: `${copy.common.edit} ${title}` }).click();
    await expect(
      main(page).getByLabel(copy.common.key, { exact: true }),
    ).toHaveValue(key);
    await main(page).getByLabel(copy.reels.form.title).fill(`${title} v2`);
    await main(page).getByRole("button", { name: copy.common.save }).click();
    await expect(main(page).getByRole("status")).toContainText(copy.common.notices.saved);

    const edited = main(page).getByRole("row").filter({ hasText: `${title} v2` });
    await edited.getByRole("button", { name: `${copy.common.delete} ${title} v2` }).click();
    await page
      .getByRole("dialog", { name: copy.common.confirmDelete.title(`${title} v2`) })
      .getByRole("button", { name: copy.common.confirmDelete.confirm })
      .click();
    await expect(main(page).getByRole("status")).toContainText(copy.common.notices.deleted);
    await expect(main(page).getByRole("row").filter({ hasText: title })).toHaveCount(0);
  });

  test("brands: add, edit and delete", async ({ page }) => {
    const key = `${E2E_CONTENT_PREFIX}brand-${token()}`;
    const name = `E2E Brand ${token()}`;
    await page.goto("/admin/content/brands/new");
    const form = main(page);
    await form.getByLabel(copy.common.key, { exact: true }).fill(key);
    await form.getByLabel(copy.brands.form.name).fill(name);
    await form.getByLabel(copy.brands.form.monogram).fill("EB");
    await form
      .getByLabel(copy.brands.form.eyebrow, { exact: true })
      .fill("TEST RANGE");
    await form.getByLabel(copy.brands.form.description).fill("Made by a test.");
    await form.getByLabel(copy.common.linkLabel).fill("View products");
    await form.getByRole("button", { name: copy.brands.add }).click();
    await expect(main(page).getByRole("status")).toContainText(copy.common.notices.created);

    const row = main(page).getByRole("row").filter({ hasText: name });
    await row.getByRole("link", { name: `${copy.common.edit} ${name}` }).click();
    await main(page).getByLabel(copy.brands.form.featured).check();
    await main(page).getByRole("button", { name: copy.common.save }).click();
    await expect(
      main(page).getByRole("row").filter({ hasText: name }),
    ).toContainText(copy.brands.featured);

    await main(page)
      .getByRole("row")
      .filter({ hasText: name })
      .getByRole("button", { name: `${copy.common.delete} ${name}` })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: copy.common.confirmDelete.confirm })
      .click();
    await expect(main(page).getByRole("row").filter({ hasText: name })).toHaveCount(0);
  });

  test("courses: add with a YouTube link, edit and delete", async ({ page }) => {
    const key = `${E2E_CONTENT_PREFIX}course-${token()}`;
    const title = `E2E Course ${token()}`;
    await page.goto("/admin/content/courses/new");
    const form = main(page);
    await form.getByLabel(copy.common.key, { exact: true }).fill(key);
    await form.getByLabel(copy.courses.form.title).fill(title);
    await form.getByLabel(copy.courses.form.body).fill("What it covers.");
    await form.getByLabel(copy.courses.form.instructor).fill("Dr E2E");
    await form.getByLabel(copy.courses.form.duration).fill("2 days");
    await form.getByLabel(copy.courses.form.videoUrl).fill("https://evil.example/video");
    await form
      .getByLabel(copy.courses.form.tag, { exact: true })
      .fill("SHORT COURSE");
    await form.getByLabel(copy.courses.form.metaLabel).fill("Format");
    await form.getByLabel(copy.courses.form.metaValue).fill("Online");
    await form.getByLabel(copy.common.linkLabel).fill("View course");
    await form.getByRole("button", { name: copy.courses.add }).click();
    await expect(form.getByText(copy.courses.errors.videoUrl)).toBeVisible();

    await form
      .getByLabel(copy.courses.form.videoUrl)
      .fill("https://www.youtube.com/watch?v=e2e");
    await form.getByRole("button", { name: copy.courses.add }).click();
    const row = main(page).getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("Dr E2E");
    await expect(row).toContainText("2 days");

    await row.getByRole("link", { name: `${copy.common.edit} ${title}` }).click();
    await main(page).getByLabel(copy.courses.form.duration).fill("3 days");
    await main(page).getByRole("button", { name: copy.common.save }).click();
    await expect(
      main(page).getByRole("row").filter({ hasText: title }),
    ).toContainText("3 days");

    await main(page)
      .getByRole("row")
      .filter({ hasText: title })
      .getByRole("button", { name: `${copy.common.delete} ${title}` })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: copy.common.confirmDelete.confirm })
      .click();
    await expect(main(page).getByRole("row").filter({ hasText: title })).toHaveCount(0);
  });

  test("quiz: build questions, reorder them, save, edit and delete", async ({
    page,
  }) => {
    const title = `${E2E_QUIZ_PREFIX}Dosha quiz ${token()}`;
    const form = copy.quiz.form;
    await page.goto("/admin/content/quiz/new");
    const builder = main(page);
    await builder.getByLabel(form.title).fill(title);

    const first = builder.getByRole("listitem", { name: form.question(1) });
    await first.getByLabel(form.prompt, { exact: true }).fill("Which dosha governs movement?");
    await first.getByLabel(`${form.question(1)}: ${form.option(1)}`).fill("Pitta");
    await first.getByLabel(`${form.question(1)}: ${form.option(2)}`).fill("Vata");
    await first.getByLabel(form.correctFor(2)).check();

    await builder.getByRole("button", { name: form.addQuestion }).click();
    const second = builder.getByRole("listitem", { name: form.question(2) });
    await second.getByLabel(form.prompt, { exact: true }).fill("How many fruits are in Triphala?");
    await second.getByLabel(form.points).fill("5");
    await second.getByLabel(`${form.question(2)}: ${form.option(1)}`).fill("Three");
    await second.getByLabel(`${form.question(2)}: ${form.option(2)}`).fill("Two");
    await second.getByRole("button", { name: form.addOption }).click();
    await second.getByLabel(`${form.question(2)}: ${form.option(3)}`).fill("Five");
    await expect(builder.getByText(form.totalPoints(15))).toBeVisible();

    // Move the Triphala question to the top.
    await second.getByRole("button", { name: form.moveUp(2) }).click();
    await expect(
      builder
        .getByRole("listitem", { name: form.question(1) })
        .getByLabel(form.prompt, { exact: true }),
    ).toHaveValue("How many fruits are in Triphala?");

    await builder.getByRole("button", { name: copy.quiz.add }).click();
    const row = main(page).getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("2");
    await expect(row).toContainText("15");
    await expect(row).toContainText(copy.quiz.draft);

    const saved = await e2eDb().quiz.findFirstOrThrow({
      where: { title },
      include: {
        questions: { orderBy: { sortOrder: "asc" }, include: { options: true } },
      },
    });
    expect(saved.questions.map((q) => q.prompt)).toEqual([
      "How many fruits are in Triphala?",
      "Which dosha governs movement?",
    ]);
    expect(
      saved.questions[1].options.find((option) => option.isCorrect)?.text,
    ).toBe("Vata");

    await row.getByRole("link", { name: `${copy.common.edit} ${title}` }).click();
    await main(page)
      .getByRole("button", { name: form.removeQuestion(2) })
      .click();
    await main(page).getByLabel(form.active).check();
    await main(page).getByRole("button", { name: copy.common.save }).click();
    const editedRow = main(page).getByRole("row").filter({ hasText: title });
    await expect(editedRow).toContainText(copy.quiz.ready);

    await editedRow
      .getByRole("button", { name: `${copy.common.delete} ${title}` })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: copy.common.confirmDelete.confirm })
      .click();
    await expect(main(page).getByRole("row").filter({ hasText: title })).toHaveCount(0);
  });

  test("orders: filters keep their values and a bad date range is flagged", async ({
    page,
  }) => {
    await page.goto("/admin/orders");
    await expect(main(page).getByRole("table", { name: copy.orders.title })).toBeVisible();
    await main(page)
      .getByLabel(copy.orders.statusFilter)
      .selectOption({ label: copy.orders.statuses.shipped });
    // Picking a status applies it straight away; dates wait for the button.
    await expect(page).toHaveURL(/status=shipped/);
    await main(page).getByLabel(copy.orders.from, { exact: true }).fill("2026-10-05");
    await main(page).getByLabel(copy.orders.to, { exact: true }).fill("2026-10-01");
    await main(page).getByRole("button", { name: copy.common.filter }).click();
    await expect(page).toHaveURL(/status=shipped/);
    await expect(main(page).getByRole("alert")).toHaveText(copy.orders.invalidDates);
    await expect(main(page).getByLabel(copy.orders.statusFilter)).toHaveValue(
      "shipped",
    );
    await expect(main(page).getByText(copy.common.noResults)).toBeVisible();
  });

  test("database browser hides passwords and tokens", async ({ page }) => {
    await page.goto("/admin/tables/Account");
    await expect(heading(page)).toHaveText("Account");
    await expect(main(page).getByText(copy.database.hidden).first()).toBeVisible();
    // Better Auth hashes look like "<32 hex salt>:<hex key>".
    expect(await page.content()).not.toMatch(/[0-9a-f]{32}:[0-9a-f]{64,}/);

    const response = await page.request.get("/api/admin/tables/Session?page=0");
    expect(response.status()).toBe(200);
    const body = JSON.stringify(await response.json());
    const sessions = await e2eDb().session.findMany({ select: { token: true } });
    expect(sessions.length).toBeGreaterThan(0);
    for (const { token } of sessions) expect(body).not.toContain(token);
  });
});
