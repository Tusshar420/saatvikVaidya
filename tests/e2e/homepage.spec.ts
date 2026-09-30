import { test, expect } from "@playwright/test";
import { ui } from "../../src/content/ui";
import { collectErrors, horizontalOverflow } from "./helpers";

// Top half of the homepage (A7). Runs in both projects (375 and 1280 px).

test.describe("Homepage sections (A7)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("hero shows its first slide heading", async ({ page }) => {
    const hero = page.locator("#top");
    await expect(hero).toBeVisible();
    await expect(
      hero.getByRole("heading", { level: 1, name: /Build your Ayurveda brand/ }),
    ).toBeVisible();
  });

  test("hero carousel has previous, next and slide buttons", async ({
    page,
  }) => {
    const hero = page.locator("#top");
    await expect(
      hero.getByRole("button", { name: ui.carousel.previous }),
    ).toBeVisible();
    await expect(
      hero.getByRole("button", { name: ui.carousel.next }),
    ).toBeVisible();
    await expect(
      hero.getByRole("button", { name: ui.carousel.goTo(2) }),
    ).toBeVisible();
  });

  test("trust strip shows its figures", async ({ page }) => {
    await expect(
      page.getByText("Classical formulations", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Low MOQ", { exact: true })).toBeVisible();
  });

  test("reels section renders reel cards", async ({ page }) => {
    const reels = page.locator("#reels");
    await reels.scrollIntoViewIfNeeded();
    await expect(
      reels.getByRole("heading", { level: 2, name: "Saatvik Reels" }),
    ).toBeVisible();
    expect(await reels.locator("article").count()).toBeGreaterThan(0);
  });

  test("offers section renders", async ({ page }) => {
    const offers = page.locator("#offers");
    await offers.scrollIntoViewIfNeeded();
    await expect(
      offers.getByRole("heading", { level: 2, name: "Offers worth acting on" }),
    ).toBeVisible();
  });

  test("quick actions section renders", async ({ page }) => {
    const actions = page.locator("#quick-actions");
    await actions.scrollIntoViewIfNeeded();
    await expect(
      actions.getByRole("heading", {
        level: 2,
        name: "What would you like to do?",
      }),
    ).toBeVisible();
  });

  test("doesn't scroll sideways", async ({ page }) => {
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test("no console errors or CSP violations", async ({ page }) => {
    const errors = collectErrors(page);
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
});
