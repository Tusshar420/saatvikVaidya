// Start-up check for a site on a server (NODE_ENV=production): the settings
// that, if wrong, would quietly break sign-in or mix the test address's
// accounts and orders with the live site's. Run from `register()` in
// src/instrumentation.ts, so a wrong setting stops the server with a clear
// message instead of showing up later as odd behaviour.
//
// The two addresses are told apart by the team password: the private test
// address has STAGING_ACCESS_PASSWORD set, the live site does not. The test
// address must use a database whose name says "test" or "staging"; the live
// site must use one whose name does not.
//
// Development, `pnpm test` and the local production build that Playwright
// tests against (site address on localhost) are not checked.

type Env = Partial<
  Record<
    "NODE_ENV" | "DATABASE_URL" | "BETTER_AUTH_URL" | "STAGING_ACCESS_PASSWORD",
    string
  >
>;

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const testishName = /test|staging/i;

function parseUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Problems with this server's settings; empty when all is well. */
export function siteSettingsProblems(env: Env = process.env): string[] {
  if (env.NODE_ENV !== "production") return [];

  const site = parseUrl(env.BETTER_AUTH_URL);
  if (!site) {
    return [
      "BETTER_AUTH_URL must be set to this site's own address, e.g. https://test.yourdomain.com.",
    ];
  }
  if (localHosts.has(site.hostname)) return [];

  const problems: string[] = [];
  if (site.protocol !== "https:") {
    problems.push(`BETTER_AUTH_URL must start with https:// on a server (it is ${site.origin}).`);
  }

  const database = parseUrl(env.DATABASE_URL);
  const name = database ? decodeURIComponent(database.pathname.slice(1)) : "";
  if (!name) {
    problems.push("DATABASE_URL must be set and name a database: mysql://USER:PASSWORD@HOST:3306/DATABASE.");
  } else if (env.STAGING_ACCESS_PASSWORD && !testishName.test(name)) {
    problems.push(
      `This is the test address (STAGING_ACCESS_PASSWORD is set), but its database "${name}" does not have "test" or "staging" in its name. Use the test address's own database, never the live one.`,
    );
  } else if (!env.STAGING_ACCESS_PASSWORD && testishName.test(name)) {
    problems.push(
      `This is the live site (STAGING_ACCESS_PASSWORD is not set), but its database "${name}" looks like a test database. Use the live site's own database, or set the team password if this is the test address.`,
    );
  }
  return problems;
}

/** Throws (so the server does not start) when the settings are wrong. */
export function assertSiteSettings(env: Env = process.env): void {
  const problems = siteSettingsProblems(env);
  if (problems.length > 0) {
    throw new Error(`Site settings need fixing before the site can start:\n- ${problems.join("\n- ")}`);
  }
}
