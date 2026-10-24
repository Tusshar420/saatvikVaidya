import path from "node:path";
import { expect, test } from "@playwright/test";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// The standalone Coming soon page (coming-soon/), uploaded on its own to the
// main address until 1 November. It isn't part of the Next.js app, so it is
// served here straight from the folder on a made-up address: no app server
// or database is involved, as on Hostinger.

const ORIGIN = "https://coming-soon.test";
const FOLDER = path.resolve(import.meta.dirname, "../../coming-soon");

test.describe("Coming soon page", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${ORIGIN}/**`, async (route) => {
      const file = new URL(route.request().url()).pathname.replace(/^\/$/, "/index.html");
      const target = path.join(FOLDER, path.normalize(file));
      if (!target.startsWith(FOLDER)) return route.fulfill({ status: 404 });
      return route.fulfill({ path: target }).catch(() => route.fulfill({ status: 404 }));
    });
    // Anything from another website would break the page's promise of being
    // self-contained (and its Content-Security-Policy would block it anyway).
    await page.route(
      (url) => url.origin !== ORIGIN,
      (route) => route.abort(),
    );
  });

  test("shows the name, launch date and a way to call, with nothing broken", async ({ page }) => {
    const errors = collectErrors(page);
    const failed: string[] = [];
    page.on("requestfailed", (request) => failed.push(request.url()));
    page.on("response", (response) => {
      if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
    });

    await page.goto(`${ORIGIN}/`);

    await expect(page).toHaveTitle(/Saatvik Vaidya/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Saatvik Vaidya opens\son 1 November 2026/ }),
    ).toBeVisible();
    await expect(page.locator("time")).toHaveAttribute("datetime", "2026-11-01");

    const logo = page.getByRole("img", { name: /Saatvik Vaidya/ });
    await expect(logo).toBeVisible();
    expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    const call = page.getByRole("link", { name: "Call +91 92203 58400" });
    await expect(call).toBeVisible();
    await expect(call).toHaveAttribute("href", "tel:+919220358400");
    const box = await call.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);

    // The site's own fonts load from the folder.
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('800 16px "Manrope"'))).toBe(true);
    expect(await page.evaluate(() => document.fonts.check('400 16px "DM Sans"'))).toBe(true);

    expect(await horizontalOverflow(page)).toBe(0);
    expect(failed).toEqual([]);
    expect(errors).toEqual([]);
    expect(await axeViolations(page)).toEqual([]);
  });

  test("fits a 360 px phone without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${ORIGIN}/`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
  });
});
