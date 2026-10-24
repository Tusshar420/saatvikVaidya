import { test, expect, type Browser, type TestInfo } from "@playwright/test";
import { account } from "../../src/content/account";
import { shell } from "../../src/content/shell";
import { horizontalOverflow } from "./helpers";

// Full-page screenshots at the six widths from docs/DESIGN.md, with checks
// that each page fits the width. Images go to Playwright's output folder
// (test-results/); copy them to docs/screenshots/ by hand when the docs need
// fresh ones. Each test opens its own browser context per width, so they
// only run in one project.

const widths = [360, 375, 414, 768, 1024, 1280];
const heights: Record<number, number> = {
  360: 800,
  375: 812,
  414: 896,
  768: 1024,
  1024: 768,
  1280: 800,
};

test.describe.configure({ timeout: 120_000 });

/** These tests set their own viewports, so one project is enough. */
function runOnce(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== "desktop",
    "Sets its own viewports; the desktop project runs it.",
  );
}

async function atWidth(browser: Browser, width: number) {
  const context = await browser.newContext({
    viewport: { width, height: heights[width] },
    isMobile: width <= 414,
    hasTouch: width <= 414,
  });
  return { context, page: await context.newPage() };
}

test.describe("A9 screenshots", () => {
  for (const [name, path] of [
    ["homepage", "/"],
    ["design", "/design"],
  ] as const) {
    test(`${name} fits every width`, async ({ browser }, testInfo) => {
      runOnce(testInfo);
      for (const width of widths) {
        const { context, page } = await atWidth(browser, width);
        await page.goto(path, { waitUntil: "load" });
        expect(await horizontalOverflow(page), `${name} at ${width}px`).toBe(0);
        await page.screenshot({
          path: testInfo.outputPath(`${name}-${width}px.png`),
          fullPage: true,
        });
        await context.close();
      }
    });
  }

  test("sign-in modal opens at every width", async ({ browser }, testInfo) => {
    runOnce(testInfo);
    for (const width of widths) {
      const { context, page } = await atWidth(browser, width);
      if (width < 560) {
        // Phones sign in from the dock's "You" page.
        await page.goto("/account");
        await page.getByRole("main").getByRole("button", { name: account.guest.signIn }).click();
      } else {
        await page.goto("/");
        await page
          .getByRole("banner")
          .getByRole("button", { name: shell.header.profileTitle })
          .click();
      }
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`sign-in-modal-${width}px.png`),
      });
      await context.close();
    }
  });

  test("/account shows the signed-out account page at every width", async ({
    browser,
  }, testInfo) => {
    runOnce(testInfo);
    for (const width of widths) {
      const { context, page } = await atWidth(browser, width);
      await page.goto("/account");
      await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`account-signed-out-${width}px.png`),
      });
      await context.close();
    }
  });
});
