import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./tests/setup/test-database.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // "server-only" throws outside React Server Components; tests run server code directly.
      "server-only": resolve(
        import.meta.dirname,
        "node_modules/server-only/empty.js",
      ),
    },
  },
  test: {
    env: {
      // Server code under test always talks to the test database, never dev data.
      DATABASE_URL: testDatabaseUrl(),
      // Fixed auth settings so tests don't depend on .env.local. The secret
      // is only for tests; it signs nothing real.
      BETTER_AUTH_SECRET: "vitest-only-secret-0123456789abcdefghijkl",
      BETTER_AUTH_URL: "http://localhost:3000",
      DEV_SHOW_OTP: "false",
    },
    globalSetup: ["./tests/setup/global-setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["src/**/*.test.ts"],
          // These files share the test database and clear its tables, so
          // they run one at a time.
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./tests/setup/dom.ts"],
        },
      },
    ],
  },
});
