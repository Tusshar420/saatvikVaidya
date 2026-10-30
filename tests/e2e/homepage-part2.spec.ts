import { test, expect } from "@playwright/test";
import { collectErrors, horizontalOverflow } from "./helpers";

// Bottom half of the homepage (A8). Runs in both projects (375 and 1280 px).
// Section titles are the seeded copy from the mockup.

const sections = [
  ["launch", "From clinical insight to a market-ready identity."],
  ["brands", "Selected ranges for professional buying"],
  ["courses", "Clinical learning, designed for application."],
  ["coins", "Growth should feel rewarding."],
  ["feedback", "Real experiences. Original words."],
  ["track", "Know exactly where your order is."],
  ["why", "One platform for your Ayurveda practice journey."],
] as const;

test.describe("Homepage part 2 (bottom half)", () => {
  test("renders every section with its title", async ({ page }) => {
    await page.goto("/");
    for (const [id, title] of sections) {
      const section = page.locator(`#${id}`);
      await section.scrollIntoViewIfNeeded();
      await expect(
        section.getByRole("heading", { level: 2, name: title }),
      ).toBeVisible();
    }
    // Quiz & Win is now a card (h3) inside the "explore" community section.
    const quiz = page.locator("#quiz");
    await quiz.scrollIntoViewIfNeeded();
    await expect(
      quiz.getByRole("heading", { level: 3, name: "Quiz & Win" }),
    ).toBeVisible();
  });

  test("nav rail includes all sections", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: /sections/i });

    // v2 rail links to pages, not to homepage sections.
    for (const name of [
      "Dr. Talk",
      "Quiz & Win",
      "Build Your Brand",
      "Top Brands",
      "Courses",
      "Saatvik Coins",
      "Track Order",
      "Real Feedback",
      "Partner & Grow",
      "Why Saatvik",
    ]) {
      await expect(
        nav.getByRole("link", { name, exact: true }),
      ).toBeVisible();
    }
  });

  test("signed out: no coin pill, and the coins section shows the equation", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("banner").getByRole("link", { name: /^[\d,]+ Saatvik Coins$/ }),
    ).toHaveCount(0);

    const coins = page.locator("#coins");
    await coins.scrollIntoViewIfNeeded();
    // v2 shows the order value -> coins -> redemption value strip.
    await expect(coins.getByText("Order value", { exact: true })).toBeVisible();
    await expect(coins.getByText("Redemption value", { exact: true })).toBeVisible();
  });

  test("launch preview switches between quantity options", async ({ page }) => {
    await page.goto("/");
    // v2 replaced the By Form / By Practice Area catalogue toggle with a live
    // product preview whose quantity buttons change the price.
    const launch = page.locator("#launch");
    await launch.scrollIntoViewIfNeeded();
    const group = launch.getByRole("radiogroup");
    await expect(group).toBeVisible();
    const radios = group.getByRole("radio");
    expect(await radios.count()).toBeGreaterThan(1);
    const first = radios.first();
    const second = radios.nth(1);
    await expect(first).toHaveAttribute("aria-checked", "true");
    await second.click();
    await expect(second).toHaveAttribute("aria-checked", "true");
    await expect(first).toHaveAttribute("aria-checked", "false");
  });

  test("doesn't scroll sideways", async ({ page }) => {
    await page.goto("/");
    await page.locator("#why").scrollIntoViewIfNeeded();
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test("no console errors", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await page.locator("#why").scrollIntoViewIfNeeded();
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
});
