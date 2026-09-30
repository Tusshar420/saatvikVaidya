import { test, expect } from "@playwright/test";

test.describe("Homepage part 2 (bottom half)", () => {
  test("renders all sections on phone", async ({ page }) => {
    await page.goto("/");

    // Launch Your Brand section
    await expect(page.getByRole("heading", { name: /launch your brand/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /step 1/i })).toBeVisible();

    // Top Brands section
    await expect(page.getByRole("heading", { name: /top brands/i })).toBeVisible();

    // Courses & Saatvik Live section
    await expect(page.getByRole("heading", { name: /courses/i })).toBeVisible();

    // Saatvik Coins section
    await expect(page.getByRole("heading", { name: /saatvik coins/i })).toBeVisible();

    // Quiz & Win section
    await expect(page.getByRole("heading", { name: /quiz/i })).toBeVisible();

    // Verified Feedback section
    await expect(page.getByRole("heading", { name: /verified feedback/i })).toBeVisible();

    // Vaidya Community section
    await expect(page.getByRole("heading", { name: /vaidya community/i })).toBeVisible();

    // Partner & Grow section
    await expect(page.getByRole("heading", { name: /partner & grow|profile completion/i })).toBeVisible();

    // Why Saatvik section
    await expect(page.getByRole("heading", { name: /why saatvik/i })).toBeVisible();
  });

  test("renders all sections on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    // Launch Your Brand section
    await expect(page.getByRole("heading", { name: /launch your brand/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /explore/i })).toBeVisible();

    // Top Brands section
    await expect(page.getByRole("heading", { name: /top brands/i })).toBeVisible();

    // Courses & Saatvik Live section
    await expect(page.getByRole("heading", { name: /courses/i })).toBeVisible();

    // Saatvik Coins section
    await expect(page.getByRole("heading", { name: /saatvik coins/i })).toBeVisible();

    // Quiz & Win section
    await expect(page.getByRole("heading", { name: /quiz/i })).toBeVisible();

    // Verified Feedback section
    await expect(page.getByRole("heading", { name: /verified feedback/i })).toBeVisible();

    // Vaidya Community section
    await expect(page.getByRole("heading", { name: /vaidya community/i })).toBeVisible();

    // Partner & Grow section
    await expect(page.getByRole("heading", { name: /partner & grow|profile completion/i })).toBeVisible();

    // Why Saatvik section
    await expect(page.getByRole("heading", { name: /why saatvik/i })).toBeVisible();
  });

  test("nav rail includes all sections", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: /sections/i });

    // Check for section links in nav rail
    await expect(nav.getByRole("link", { name: /launch your brand/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /top brands/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /courses/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /saatvik coins/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /quiz/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /verified feedback/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /partner/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /why saatvik/i })).toBeVisible();
  });

  test("shows coin balance when signed out", async ({ page }) => {
    await page.goto("/");

    // The coin pill should be hidden when signed out
    const coinPill = page.locator('[href="/coins"]');
    await expect(coinPill).not.toBeVisible();

    // But the coins section should show the equation
    const coinsSection = page.getByRole("region").filter({
      has: page.getByRole("heading", { name: /saatvik coins/i }),
    });
    await expect(coinsSection.getByText(/coin/i)).toBeVisible();
  });

  test("launch section has form and practice area tabs", async ({ page }) => {
    await page.goto("/");

    // Find the launch section
    const launchSection = page.getByRole("region").filter({
      has: page.getByRole("heading", { name: /launch your brand/i }),
    });

    // Find the tab buttons
    const formTab = launchSection.getByRole("button").filter({ hasText: /form/i }).first();
    const areaTab = launchSection.getByRole("button").filter({ hasText: /area|practice/i }).first();

    // Both tabs should exist
    await expect(formTab).toBeVisible();
    await expect(areaTab).toBeVisible();
  });

  test("no horizontal scroll at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const body = page.locator("body");
    const scrollWidth = await body.evaluate((el) => el.scrollWidth);
    const clientWidth = await body.evaluate((el) => el.clientWidth);

    expect(scrollWidth).toBe(clientWidth);
  });

  test("no horizontal scroll at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    const body = page.locator("body");
    const scrollWidth = await body.evaluate((el) => el.scrollWidth);
    const clientWidth = await body.evaluate((el) => el.clientWidth);

    expect(scrollWidth).toBe(clientWidth);
  });

  test("no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");

    // Scroll to bottom to load all sections
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
  });
});
