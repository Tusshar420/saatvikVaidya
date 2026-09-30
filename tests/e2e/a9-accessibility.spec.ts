import { test, expect } from "@playwright/test";
import { axeViolations } from "./helpers";

test.describe("A9 Accessibility Checks", () => {
  test.use({ baseURL: "http://localhost:3100" });

  test("homepage has no axe violations at 360px", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const violations = await axeViolations(page);
    expect(violations).toEqual([]);

    await context.close();
  });

  test("homepage has no axe violations at 1280px", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const violations = await axeViolations(page);
    expect(violations).toEqual([]);

    await context.close();
  });

  test("/account page has no axe violations", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto("/account");
    await page.waitForLoadState("networkidle");

    const violations = await axeViolations(page);
    expect(violations).toEqual([]);

    await context.close();
  });

  test("/design page has no axe violations", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto("/design");
    await page.waitForLoadState("networkidle");

    const violations = await axeViolations(page);
    expect(violations).toEqual([]);

    await context.close();
  });
});
