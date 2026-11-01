import { test, expect, type Page } from "@playwright/test";
import { notifications as copy } from "../../src/content/notifications";
import { e2eDb, signInAs, useFreshIp } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// The header's bell: the unread badge, the panel with All / Unread / Read,
// opening a notification at its page (which marks it read), "Mark all as
// read", and the /notifications page.

const bell = (page: Page) => page.getByTestId("notification-bell");
const panel = (page: Page) => page.getByRole("dialog", { name: copy.panel.title });

async function seed(userId: string) {
  const db = e2eDb();
  const base = { userId, kind: "order" as const };
  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);
  await db.notification.create({
    data: { ...base, title: "E2E read one", body: "Seen already.", href: "/orders", readAt: at(1), createdAt: at(90) },
  });
  await db.notification.create({
    data: { ...base, title: "E2E open my account", body: "Opens My account.", href: "/account", createdAt: at(30) },
  });
  await db.notification.create({
    data: { ...base, kind: "brand", title: "E2E label proof ready", body: "Opens the cart.", href: "/cart", createdAt: at(2) },
  });
}

test("signed out there is no bell, and /notifications asks to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Bag/ }).first()).toBeVisible();
  await expect(bell(page)).toHaveCount(0);
  await page.goto("/notifications");
  await expect(page).toHaveURL(/auth=sign-in/);
  const api = await page.request.get("/api/notifications");
  expect(api.status()).toBe(401);
});

test("the bell lists read and unread notifications and opens the one clicked", async ({ page, baseURL }) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const user = await signInAs(page, baseURL!, { role: "user" });
  await seed(user.id);

  // The cart page: no scroll-reveal sections behind the panel for axe.
  await page.goto("/cart");
  await expect(bell(page)).toHaveAccessibleName(copy.bell.label(2));
  await expect(page.getByTestId("notification-count")).toHaveText("2");

  await bell(page).click();
  const dialog = panel(page);
  await expect(dialog).toBeVisible();
  const items = dialog.getByTestId("notification");
  await expect(items).toHaveCount(3);
  // Newest first; unread ones say so.
  await expect(items.first()).toContainText("E2E label proof ready");
  await expect(items.first()).toHaveAttribute("data-read", "false");
  await expect(items.last()).toHaveAttribute("data-read", "true");
  expect(await horizontalOverflow(page)).toBe(0);
  expect(await axeViolations(page)).toEqual([]);

  await dialog.getByRole("tab", { name: copy.filters.unread }).click();
  await expect(items).toHaveCount(2);
  await dialog.getByRole("tab", { name: copy.filters.read, exact: true }).click();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("E2E read one");
  await dialog.getByRole("tab", { name: copy.filters.all, exact: true }).click();
  await expect(items).toHaveCount(3);

  // Clicking one opens its page and marks it read.
  await dialog.getByRole("link", { name: /E2E open my account/ }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("notification-count")).toHaveText("1");
  await expect
    .poll(async () => {
      const row = await e2eDb().notification.findFirstOrThrow({
        where: { userId: user.id, title: "E2E open my account" },
      });
      return row.readAt !== null;
    })
    .toBe(true);

  // Esc closes the panel and gives focus back to the bell.
  await bell(page).click();
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(bell(page)).toBeFocused();

  // "Mark all as read" in the panel.
  await bell(page).click();
  await panel(page).getByRole("button", { name: copy.markAllRead }).click();
  await expect(page.getByTestId("notification-count")).toHaveCount(0);
  // The panel is open, so the page behind it (the bell too) is hidden from
  // screen readers; check the label itself.
  await expect(bell(page)).toHaveAttribute("aria-label", copy.bell.label(0));
  await panel(page).getByRole("tab", { name: copy.filters.unread }).click();
  await expect(panel(page).getByText(copy.empty.unread.title)).toBeVisible();
  expect(await e2eDb().notification.count({ where: { userId: user.id, readAt: null } })).toBe(0);
  expect(errors).toEqual([]);
});

test("the notifications page: filters, opening one, mark all as read", async ({ page, baseURL }) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const user = await signInAs(page, baseURL!, { role: "user" });
  await seed(user.id);

  await page.goto("/orders");
  await bell(page).click();
  await panel(page).getByRole("link", { name: copy.panel.seeAll }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(page.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();
  const list = page.getByRole("list", { name: copy.listLabel });
  await expect(list.getByTestId("notification")).toHaveCount(3);
  expect(await horizontalOverflow(page)).toBe(0);
  expect(await axeViolations(page)).toEqual([]);

  const filters = page.getByRole("navigation", { name: copy.filters.label });
  await filters.getByRole("link", { name: new RegExp(`^${copy.filters.unread}`) }).click();
  await expect(page).toHaveURL(/show=unread/);
  await expect(list.getByTestId("notification")).toHaveCount(2);
  await filters.getByRole("link", { name: copy.filters.read, exact: true }).click();
  await expect(list.getByTestId("notification")).toHaveCount(1);

  await filters.getByRole("link", { name: copy.filters.all, exact: true }).click();
  await list.getByRole("link", { name: /E2E label proof ready/ }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByTestId("notification-count")).toHaveText("1");

  await page.goto("/notifications?show=unread");
  await expect(list.getByTestId("notification")).toHaveCount(1);
  await page.getByRole("button", { name: copy.markAllRead }).click();
  await expect(page.getByText(copy.empty.unread.title)).toBeVisible();
  await expect(page.getByTestId("notification-count")).toHaveCount(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("someone else's notification can't be marked read", async ({ page, baseURL }) => {
  await useFreshIp(page);
  const other = await signInAs(page, baseURL!, { role: "user" });
  const theirs = await e2eDb().notification.create({
    data: { userId: other.id, kind: "order", title: "E2E theirs", body: "", href: "/orders" },
  });
  await page.context().clearCookies();
  await signInAs(page, baseURL!, { role: "user" });
  const response = await page.request.post(`/api/notifications/${theirs.id}/read`, {
    headers: { origin: baseURL! },
  });
  expect(response.status()).toBe(404);
  const crossSite = await page.request.post("/api/notifications/read-all", {
    headers: { origin: "https://evil.test" },
  });
  expect(crossSite.status()).toBe(403);
  const row = await e2eDb().notification.findUniqueOrThrow({ where: { id: theirs.id } });
  expect(row.readAt).toBeNull();
});

test("sections with a new notification get a badge on their nav link", async ({
  page,
  baseURL,
  isMobile,
}) => {
  await useFreshIp(page);
  const errors = collectErrors(page);
  const user = await signInAs(page, baseURL!, { role: "user" });
  const db = e2eDb();
  const href = (path: string) => ({ body: "", href: path });
  await db.notification.createMany({
    data: [
      { userId: user.id, kind: "course", title: "E2E new course", ...href("/courses") },
      { userId: user.id, kind: "course", title: "E2E new course 2", ...href("/courses") },
      { userId: user.id, kind: "doctor_talk", title: "E2E new thread", ...href("/doctor-talk") },
      { userId: user.id, kind: "quiz", title: "E2E quiz open", ...href("/quiz") },
      { userId: user.id, kind: "top_brands", title: "E2E new brand", ...href("/products") },
    ],
  });

  await page.goto("/cart");
  const rail = page.getByRole("navigation", { name: "Sections" });
  const badge = (name: RegExp) => rail.getByRole("link", { name }).getByTestId("nav-badge");
  await expect(badge(/Courses/)).toHaveText("2");
  await expect(badge(/Dr\. Talk/)).toHaveText("1");
  // Phones leave Quiz & Win out of the rail (the bottom dock has it).
  if (!isMobile) await expect(badge(/Quiz & Win/)).toHaveText("1");
  await expect(badge(/Top Brands/)).toHaveText("1");
  await expect(rail.getByRole("link", { name: /Top Brands/ })).toContainText("1 new");
  // The bell counts all five.
  await expect(page.getByTestId("notification-count")).toHaveText("5");
  expect(await horizontalOverflow(page)).toBe(0);

  // Opening one clears its section's badge: Quiz & Win, or Dr. Talk on
  // phones, where the rail has no Quiz & Win link.
  const opened = isMobile
    ? { title: /E2E new thread/, url: /\/doctor-talk/, link: /Dr\. Talk/ }
    : { title: /E2E quiz open/, url: /\/quiz/, link: /Quiz & Win/ };
  await bell(page).click();
  await panel(page).getByRole("link", { name: opened.title }).click();
  await expect(page).toHaveURL(opened.url);
  await expect(badge(opened.link)).toHaveCount(0);
  await expect(badge(/Top Brands/)).toHaveText("1");
  expect(errors).toEqual([]);
});

test("no section badges signed out", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("nav-badge")).toHaveCount(0);
});
