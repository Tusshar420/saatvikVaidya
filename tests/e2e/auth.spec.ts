import { expect, test } from "@playwright/test";
import { collectErrors } from "./helpers";

// Auth backend checks against the production build. The sign-in UI and its
// flows are in sign-in.spec.ts.

test.describe("protected pages", () => {
  for (const path of ["/account", "/admin", "/admin/users"]) {
    test(`${path} sends a signed-out visitor to sign-in`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(path);
      const url = new URL(page.url());
      expect(url.pathname).toBe("/");
      expect(url.searchParams.get("auth")).toBe("sign-in");
      expect(url.searchParams.get("next")).toBe(path);
      await expect(page.locator("main#main")).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test("a made-up session cookie doesn't reach /account", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: "sv.session_token", value: "forged.value", url: baseURL! },
    ]);
    await page.goto("/account");
    // The proxy lets it through (cookie present); the page itself checks the
    // session and sends the visitor to sign-in.
    const url = new URL(page.url());
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("auth")).toBe("sign-in");
    expect(url.searchParams.get("next")).toBe("/account");
    await expect(page.locator("main#main")).not.toContainText("Namaste");
  });
});

test.describe("auth API", () => {
  test("reports no session when signed out", async ({ request }) => {
    const response = await request.get("/api/auth/get-session");
    expect(response.status()).toBe(200);
    expect(await response.json()).toBeNull();
  });

  test("the dev OTP route is off in production, even with DEV_SHOW_OTP=true", async ({
    request,
  }) => {
    const response = await request.get("/api/dev/otp?phone=9876543210");
    expect(response.status()).toBe(404);
  });

  test("refuses requests from other origins", async ({ request }) => {
    const response = await request.post("/api/auth/sign-in/email", {
      headers: { origin: "https://evil.example" },
      data: { email: "someone@example.com", password: "whatever-1234" },
    });
    expect(response.status()).toBe(403);
  });
});
