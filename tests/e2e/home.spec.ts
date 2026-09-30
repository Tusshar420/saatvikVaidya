import { expect, test } from "@playwright/test";
import { placeholderHome } from "../../src/content/site";

test("placeholder home page loads cleanly", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    placeholderHome.titleEmphasis,
  );

  // Security headers from next.config.ts are present.
  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();

  // Nothing scrolls sideways.
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // No CSP violations or runtime errors in the console.
  expect(errors).toEqual([]);
});
