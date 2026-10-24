import { describe, expect, it } from "vitest";
import { assertSiteSettings, siteSettingsProblems } from "@/server/site-check";

const live = {
  NODE_ENV: "production",
  BETTER_AUTH_URL: "https://yourdomain.com",
  DATABASE_URL: "mysql://u1_live:pw@db.host:3306/u1_saatvik",
};
const testAddress = {
  NODE_ENV: "production",
  BETTER_AUTH_URL: "https://test.yourdomain.com",
  DATABASE_URL: "mysql://u1_test:pw@db.host:3306/u1_saatvik_test",
  STAGING_ACCESS_PASSWORD: "a-long-team-password",
};

describe("site settings check", () => {
  it("accepts correct live and test address settings", () => {
    expect(siteSettingsProblems(live)).toEqual([]);
    expect(siteSettingsProblems(testAddress)).toEqual([]);
    expect(siteSettingsProblems({ ...testAddress, DATABASE_URL: "mysql://u:p@h:3306/u1_STAGING" })).toEqual([]);
  });

  it("skips development, tests and the local production build", () => {
    expect(siteSettingsProblems({ NODE_ENV: "development" })).toEqual([]);
    expect(siteSettingsProblems({ NODE_ENV: "test" })).toEqual([]);
    expect(
      siteSettingsProblems({
        NODE_ENV: "production",
        BETTER_AUTH_URL: "http://localhost:3100",
        DATABASE_URL: "mysql://root@localhost:3306/saatvik_vaidya",
      }),
    ).toEqual([]);
  });

  it("needs the site address on a server, over https", () => {
    expect(siteSettingsProblems({ ...live, BETTER_AUTH_URL: undefined })[0]).toMatch(/BETTER_AUTH_URL must be set/);
    expect(siteSettingsProblems({ ...live, BETTER_AUTH_URL: "not a url" })[0]).toMatch(/BETTER_AUTH_URL must be set/);
    expect(siteSettingsProblems({ ...live, BETTER_AUTH_URL: "http://yourdomain.com" })[0]).toMatch(/https/);
  });

  it("needs a database name", () => {
    expect(siteSettingsProblems({ ...live, DATABASE_URL: undefined })[0]).toMatch(/DATABASE_URL must be set/);
    expect(siteSettingsProblems({ ...live, DATABASE_URL: "mysql://u:p@h:3306/" })[0]).toMatch(/DATABASE_URL must be set/);
  });

  it("stops the test address from using the live database", () => {
    const problems = siteSettingsProblems({ ...testAddress, DATABASE_URL: live.DATABASE_URL });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/test address/);
  });

  it("stops the live site from using the test database", () => {
    const problems = siteSettingsProblems({ ...live, DATABASE_URL: testAddress.DATABASE_URL });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/live site/);
  });

  it("throws with every problem listed", () => {
    expect(() => assertSiteSettings(live)).not.toThrow();
    expect(() =>
      assertSiteSettings({ ...testAddress, BETTER_AUTH_URL: "http://test.yourdomain.com", DATABASE_URL: live.DATABASE_URL }),
    ).toThrow(/https[\s\S]*test address/);
  });
});
