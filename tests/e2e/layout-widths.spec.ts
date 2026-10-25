import { expect, test } from "@playwright/test";

// Public pages must not scroll sideways or log console errors at common
// phone, tablet and desktop widths (BUG-008).
const pages = ["/", "/products", "/courses", "/ebooks", "/launch", "/cart", "/quiz", "/partner", "/why-saatvik", "/doctor-talk", "/feedback", "/terms"];
const widths = [360, 390, 414, 768, 1280];

test.describe("layout widths", () => {
  for (const width of widths) {
    test(`no sideways scroll or console errors at ${width}px`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.setViewportSize({ width, height: 800 });
      for (const path of pages) {
        const res = await page.goto(path);
        expect(res?.status(), path).toBeLessThan(400);
        await page.waitForLoadState("networkidle");
        const over = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(over, `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
      expect(errors).toEqual([]);
    });
  }
});
