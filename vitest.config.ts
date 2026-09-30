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
    // Server code under test always talks to the test database, never dev data.
    env: { DATABASE_URL: testDatabaseUrl() },
    globalSetup: ["./tests/setup/global-setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["src/**/*.test.ts"],
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
