import { execFileSync } from "node:child_process";

/**
 * The test database URL, from TEST_DATABASE_URL. Refuses anything whose
 * database name doesn't end in "_test", so tests can never touch dev data.
 */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Copy it from .env.example into .env.local.",
    );
  }
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(
      `TEST_DATABASE_URL must name a database ending in "_test" (got "${name}").`,
    );
  }
  return url;
}

/** Creates the test database if needed and applies all migrations to it. */
export function prepareTestDatabase(): void {
  execFileSync("prisma", ["migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
  });
}
