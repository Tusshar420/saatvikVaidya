import { defineConfig, devices } from "@playwright/test";

// The pay-by-QR / bank-transfer flow (PAYMENT_PROVIDER=manual). The main
// config's server uses the test provider, so these specs get their own
// production build running on another port. Run with
// `pnpm test:e2e:manual` (also part of `pnpm test:e2e`).

const PORT = 3101;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /\.manual\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: ["./tests/e2e/cleanup.ts", "./tests/e2e/pin-discount.ts"],
  globalTeardown: "./tests/e2e/cleanup.ts",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    {
      name: "phone",
      use: { ...devices["Pixel 7"], browserName: "chromium", viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true },
    },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      BETTER_AUTH_URL: baseURL,
      PAYMENT_PROVIDER: "manual",
      SHIPPING_PROVIDER: "test",
      TEST_SHIPPING_IN_LOCAL_BUILD: "true",
    },
  },
});
