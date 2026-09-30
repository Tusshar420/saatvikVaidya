import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { designPage } from "../../src/content/design";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  // A compact summary makes failures readable in the test output.
  return results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target.join(" ")),
  }));
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

test.describe("/design showcase", () => {
  test("loads cleanly with every group", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto("/design");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      designPage.title,
    );

    for (const title of Object.values(designPage.groups)) {
      await expect(
        page.getByRole("heading", { level: 2, name: title }),
      ).toBeVisible();
    }
    for (const title of Object.values(designPage.sections)) {
      await expect(
        page.getByRole("heading", { level: 3, name: title, exact: true }),
      ).toBeAttached();
    }

    // Scroll through the whole page so lazy work (fonts, images) runs.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState("networkidle");

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test("has no WCAG A/AA violations", async ({ page }) => {
    // Stops the carousel so axe doesn't catch a slide mid-fade.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/design");
    await page.waitForLoadState("networkidle");
    expect(await axeViolations(page)).toEqual([]);
  });

  test("modal is a bottom sheet on phones, centred on desktop, and closes with Escape", async ({
    page,
    isMobile,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/design");
    const trigger = page.getByRole("button", { name: designPage.modal.open });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: designPage.modal.title });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription(
      designPage.modal.description,
    );

    await dialog.evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished)),
    );
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport).toBeTruthy();
    if (box && viewport) {
      if (isMobile) {
        // Full width, anchored to the bottom edge.
        expect(Math.round(box.x)).toBe(0);
        expect(Math.round(box.width)).toBe(viewport.width);
        expect(Math.round(box.y + box.height)).toBe(viewport.height);
      } else {
        expect(box.width).toBeLessThanOrEqual(530);
        expect(
          Math.abs(box.x + box.width / 2 - viewport.width / 2),
        ).toBeLessThan(2);
      }
    }

    // Focus stays inside the dialog.
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);

    expect(await axeViolations(page)).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("shows a toast", async ({ page }) => {
    await page.goto("/design");
    await page.getByRole("button", { name: designPage.toast.success }).click();
    await expect(
      page.getByText(designPage.toast.successBody, { exact: true }),
    ).toBeVisible();
  });
});
