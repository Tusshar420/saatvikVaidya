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
      hero.getByRole("heading", { level: 1, name: /Learn\.\s*Connect\.\s*Build\.\s*Grow\./ }),
    ).toBeVisible();
  });

  test("hero carousel has slide dots and no arrow buttons", async ({
    page,
  }) => {
    const hero = page.locator("#top");
    await expect(
      hero.getByRole("button", { name: ui.carousel.goTo(2) }),
    ).toBeVisible();
    await expect(
      hero.getByRole("button", { name: /^(Previous|Next) slide$/ }),
    ).toHaveCount(0);
  });

  test("dragging the hero left and right changes the slide", async ({
    page,
  }) => {
    const hero = page.locator("#top");
    await hero.getByRole("button", { name: ui.carousel.pause }).click();
    const box = await hero.getByRole("heading", { level: 1 }).boundingBox();
    if (!box) throw new Error("hero heading has no box");
    const y = box.y + box.height / 2;
    const drag = async (from: number, to: number) => {
      await page.mouse.move(from, y);
      await page.mouse.down();
      await page.mouse.move(to, y, { steps: 5 });
      await page.mouse.up();
    };
    const dot = (n: number) =>
      hero.getByRole("button", { name: ui.carousel.goTo(n) });

    await drag(box.x + 200, box.x + 20);
    await expect(dot(2)).toHaveAttribute("aria-current", "true");
    await expect(page).toHaveURL("/");

    await drag(box.x + 20, box.x + 200);
    await expect(dot(1)).toHaveAttribute("aria-current", "true");
  });

  test("hero no longer shows the stat strip", async ({ page }) => {
    await expect(
      page.getByText("Classical formulations", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("Low MOQ", { exact: true })).toHaveCount(0);
  });

  test("reels section renders reel cards", async ({ page }) => {
    const reels = page.locator("#reels");
    await reels.scrollIntoViewIfNeeded();
    await expect(
      reels.getByRole("heading", { level: 2, name: "Saatvik Reels" }),
    ).toBeVisible();
    expect(await reels.getByRole("list", { name: "Reels" }).locator("li").count()).toBeGreaterThan(0);
  });

  // The v2 redesign removed the Offers and Quick actions sections from the
  // homepage, so the tests for them are gone; this checks they stay gone.
  test("offers and quick actions sections are no longer on the homepage", async ({
    page,
  }) => {
    await expect(page.locator("#offers")).toHaveCount(0);
    await expect(page.locator("#quick-actions")).toHaveCount(0);
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
