import { test, expect } from "@playwright/test";
import { collectErrors, horizontalOverflow } from "./helpers";

// Bottom half of the homepage (A8). Runs in both projects (375 and 1280 px).
// Section titles are the seeded copy from the mockup.

const sections = [
  ["launch", "From clinical insight to a market-ready identity."],
  ["brands", "Selected ranges for professional buying"],
  ["courses", "Clinical learning, designed for application."],
  ["coins", "Growth should feel rewarding."],
  ["quiz", "How strong is your Ayurveda knowledge?"],
  ["feedback", "Real experiences. Original words."],
  ["community", "Vaidya Community"],
  ["partner", "Complete your professional profile."],
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
  });

  test("nav rail includes all sections", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: /sections/i });

    await expect(nav.getByRole("link", { name: /launch your brand/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /top brands/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /courses/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /saatvik coins/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /quiz/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /verified feedback/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /partner/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /why saatvik/i })).toBeVisible();
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
    await expect(coins.getByText("10 Coins", { exact: true })).toBeVisible();
  });

  test("launch catalogue switches between form and practice area", async ({
    page,
  }) => {
    await page.goto("/");
    const catalogue = page.locator("#launch-catalogue");
    await catalogue.scrollIntoViewIfNeeded();
    const byForm = catalogue.getByRole("button", { name: "By Form" });
    const byArea = catalogue.getByRole("button", { name: "By Practice Area" });

    await expect(byForm).toHaveAttribute("aria-pressed", "true");
    await expect(byArea).toHaveAttribute("aria-pressed", "false");
    await byArea.click();
    await expect(byArea).toHaveAttribute("aria-pressed", "true");
    await expect(byForm).toHaveAttribute("aria-pressed", "false");
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
