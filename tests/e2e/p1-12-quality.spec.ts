import {
  test,
  expect,
  type Browser,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { axeViolations, horizontalOverflow } from "./helpers";

// P1.12: the public Phase 1 pages fit every width from 360 to 1280 px and
// have no serious or critical axe issues. Signed-in and admin screens are
// covered by their own chunk specs. Each test opens its own contexts, so only
// the desktop project runs it.

const widths = [360, 375, 414, 768, 1024, 1280];

test.describe.configure({ timeout: 180_000 });

function runOnce(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== "desktop",
    "Sets its own viewports; the desktop project runs it.",
  );
}

async function open(browser: Browser, width: number) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 414 ? 800 : 768 },
    isMobile: width <= 414,
    hasTouch: width <= 414,
  });
  return { context, page: await context.newPage() };
}

/** The first detail link on a list page, or none (the seed has no ebooks). */
async function detailPaths(page: Page, listPath: string) {
  await page.goto(listPath);
  const href = await page
    .locator(`a[href^="${listPath}/"]`)
    .first()
    .getAttribute("href", { timeout: 3000 })
    .catch(() => null);
  return href ? [href] : [];
}

const staticPaths = [
  "/products",
  "/ebooks",
  "/cart",
  "/search",
  "/coins",
  "/track",
  "/shipping",
  "/rewards-policy",
  "/privacy",
  "/terms",
];

test.describe("P1.12 quality pass", () => {
  test("public pages fit every width", async ({ browser }, testInfo) => {
    runOnce(testInfo);
    const probe = await open(browser, 375);
    const paths = [
      ...staticPaths,
      ...(await detailPaths(probe.page, "/products")),
      ...(await detailPaths(probe.page, "/ebooks")),
    ];
    await probe.context.close();
    for (const width of widths) {
      const { context, page } = await open(browser, width);
      for (const path of paths) {
        await page.goto(path, { waitUntil: "load" });
        expect(await horizontalOverflow(page), `${path} at ${width}px`).toBe(0);
      }
      await context.close();
    }
  });

  test("public pages have no axe violations", async ({ browser }, testInfo) => {
    runOnce(testInfo);
    for (const width of [360, 1280]) {
      const { context, page } = await open(browser, width);
      const paths = [
        ...staticPaths,
        ...(await detailPaths(page, "/products")),
        ...(await detailPaths(page, "/ebooks")),
      ];
      for (const path of paths) {
        await page.goto(path, { waitUntil: "load" });
        expect(await axeViolations(page), `${path} at ${width}px`).toEqual([]);
      }
      await context.close();
    }
  });
});
