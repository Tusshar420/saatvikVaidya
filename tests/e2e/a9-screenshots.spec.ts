import { test, expect } from "@playwright/test";

const widths = [360, 375, 414, 768, 1024, 1280];
const heights: Record<number, number> = {
  360: 800,
  375: 812,
  414: 896,
  768: 1024,
  1024: 768,
  1280: 800,
};

test.describe("A9 Screenshots", () => {
  test("homepage screenshots at all widths", async ({ browser }) => {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: heights[width] },
        isMobile: width <= 414,
        hasTouch: width <= 414,
      });
      const page = await context.newPage();

      await page.goto("http://localhost:3100/");
      await page.waitForLoadState("networkidle");

      const filename = `docs/screenshots/homepage-${width}px.png`;
      await page.screenshot({ path: filename, fullPage: true });
      console.log(`Saved ${filename}`);

      await context.close();
    }
  });

  test("sign-in modal screenshots at all widths", async ({ browser }) => {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: heights[width] },
        isMobile: width <= 414,
        hasTouch: width <= 414,
      });
      const page = await context.newPage();

      await page.goto("http://localhost:3100/");
      await page.waitForLoadState("networkidle");

      // Open sign-in modal
      if (width <= 560) {
        // On mobile, click the profile icon in the dock
        await page.click('[aria-current="page"][href="/#profile"]');
      } else {
        // On desktop, click the profile trigger in the header
        const profileTrigger = page.locator("button").filter({ hasText: /Sign in|Register/ }).first();
        await profileTrigger.click();
      }

      await page.waitForSelector('[role="dialog"]');
      const filename = `docs/screenshots/sign-in-modal-${width}px.png`;
      await page.screenshot({ path: filename, fullPage: true });
      console.log(`Saved ${filename}`);

      await context.close();
    }
  });

  test("/account page screenshots at all widths", async ({ browser }) => {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: heights[width] },
        isMobile: width <= 414,
        hasTouch: width <= 414,
      });
      const page = await context.newPage();

      // Try to navigate to /account (will redirect to sign-in if not signed in)
      await page.goto("http://localhost:3100/account");
      await page.waitForLoadState("networkidle");

      const filename = `docs/screenshots/account-${width}px.png`;
      await page.screenshot({ path: filename, fullPage: true });
      console.log(`Saved ${filename}`);

      await context.close();
    }
  });

  test("/design page screenshots at all widths", async ({ browser }) => {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: heights[width] },
        isMobile: width <= 414,
        hasTouch: width <= 414,
      });
      const page = await context.newPage();

      await page.goto("http://localhost:3100/design");
      await page.waitForLoadState("networkidle");

      const filename = `docs/screenshots/design-${width}px.png`;
      await page.screenshot({ path: filename, fullPage: true });
      console.log(`Saved ${filename}`);

      await context.close();
    }
  });
});
