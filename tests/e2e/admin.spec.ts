import { test, expect } from "@playwright/test";

test.describe("Admin Panel", () => {
  test("redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/admin");
    expect(page.url()).toContain("/?auth=sign-in");
  });

  test("admin route exists and is protected", async ({ page }) => {
    // Just verify the route redirects as expected
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(200); // redirect followed
    expect(page.url()).toContain("/?auth=sign-in");
  });

  test("admin table route is protected", async ({ page }) => {
    const response = await page.goto("/admin/tables/User");
    expect(response?.status()).toBe(200); // redirect followed
    expect(page.url()).toContain("/?auth=sign-in");
  });
});
