import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

const exclusive = /\.exclusive\.spec\.ts$/;
// Quiz & Win: one open quiz shows on the homepage, so this spec runs alone,
// after the exclusive ones (they change site-wide settings at the same time).
const last = /\.last\.spec\.ts$/;

const phone = {
  ...devices["Pixel 7"],
  browserName: "chromium" as const,
  viewport: { width: 375, height: 812 },
  hasTouch: true,
  isMobile: true,
};

const desktop = {
  ...devices["Desktop Chrome"],
  viewport: { width: 1280, height: 800 },
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // The whole suite runs in parallel against one production server (and axe
  // scans are slow), so allow more than the defaults (30 s and 5 s) before
  // calling a step stuck.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Sign-in tests create accounts in the dev database; these remove them.
  globalSetup: "./tests/e2e/cleanup.ts",
  globalTeardown: "./tests/e2e/cleanup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "phone",
      testIgnore: [exclusive, last],
      use: phone,
    },
    {
      name: "desktop",
      testIgnore: [exclusive, last],
      use: desktop,
    },
    // Specs that change site-wide settings (maintenance mode, checkout off,
    // the footer) would break every test running beside them, so they run on
    // their own: after the other projects, one project after the other.
    {
      name: "phone-exclusive",
      testMatch: exclusive,
      dependencies: ["phone", "desktop"],
      use: phone,
    },
    {
      name: "desktop-exclusive",
      testMatch: exclusive,
      dependencies: ["phone-exclusive"],
      use: desktop,
    },
    {
      name: "phone-last",
      testMatch: last,
      dependencies: ["desktop-exclusive"],
      use: phone,
    },
    {
      name: "desktop-last",
      testMatch: last,
      dependencies: ["phone-last"],
      use: desktop,
    },
  ],
  // Tests run against a production build (real CSP and headers) on its own
  // port, so a `pnpm dev` server on :3000 can keep running alongside.
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      // The /design showcase is off in production unless this is set.
      SHOW_DESIGN_PAGE: "true",
      // Auth must know its own origin for links and the CSRF origin check.
      BETTER_AUTH_URL: baseURL,
      // The test payment provider refuses production builds; this local
      // build (on localhost) may use it so checkout can be tested end to end.
      PAYMENT_PROVIDER: "test",
      TEST_PAYMENTS_IN_LOCAL_BUILD: "true",
      // The same for the test shipping provider (simulated delivery steps).
      SHIPPING_PROVIDER: "test",
      TEST_SHIPPING_IN_LOCAL_BUILD: "true",
    },
  },
});
