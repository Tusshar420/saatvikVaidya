import { test } from "@playwright/test";

const widths = [360, 375, 414, 768, 1024, 1280];

test.describe("A9 Modal Screenshots", () => {
  test.use({ baseURL: "http://localhost:3100" });

  test("sign-in modal at various widths", async ({ browser }) => {
    for (const width of widths) {
      let height = 800;
      if (width === 375) height = 812;
      if (width === 414) height = 896;
      if (width === 768) height = 1024;
      if (width === 1024) height = 768;

      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: width <= 414,
        hasTouch: width <= 414,
      });

      const page = await context.newPage();

      // Navigate to home
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Click sign-in button based on viewport
      if (width <= 560) {
        // Mobile - click profile in dock
        const profileLink = page.locator("a:has-text('Profile')").last();
        await profileLink.click();
      } else {
        // Desktop - click profile in header
        const button = page.locator("button:has-text('Sign in')").first();
        if (await button.isVisible()) {
          await button.click();
        } else {
          // Try the profile trigger
          const userBtn = page.locator("button[aria-label*='profile'], button:has-text('Register')").first();
          await userBtn.click();
        }
      }

      // Wait for modal to appear
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});

      const filename = `docs/screenshots/modal-signin-${width}px.png`;
      await page.screenshot({ path: filename, fullPage: true });
      console.log(`Saved ${filename}`);

      await context.close();
    }
  });
});
