import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";

function header(isDev: boolean, key: string): string | undefined {
  return securityHeaders({ isDev }).find((h) => h.key === key)?.value;
}

describe("security headers", () => {
  it("forbids framing the site", () => {
    expect(contentSecurityPolicy({ isDev: false })).toContain(
      "frame-ancestors 'none'",
    );
    expect(header(false, "X-Frame-Options")).toBe("DENY");
  });

  it("only allows eval and websockets in development", () => {
    const prod = contentSecurityPolicy({ isDev: false });
    const dev = contentSecurityPolicy({ isDev: true });
    expect(prod).not.toContain("'unsafe-eval'");
    expect(prod).not.toContain("ws:");
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("ws:");
  });

  it("blocks plugins and foreign form posts", () => {
    const csp = contentSecurityPolicy({ isDev: false });
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("upgrades insecure requests in production unless the site is plain http", () => {
    const upgrade = "upgrade-insecure-requests";
    expect(contentSecurityPolicy({ isDev: false })).toContain(upgrade);
    expect(
      contentSecurityPolicy({
        isDev: false,
        siteOrigin: "https://saatvikvaidya.com",
      }),
    ).toContain(upgrade);
    expect(
      contentSecurityPolicy({
        isDev: false,
        siteOrigin: "http://localhost:3100",
      }),
    ).not.toContain(upgrade);
    expect(contentSecurityPolicy({ isDev: true })).not.toContain(upgrade);
  });

  it("sets referrer and permissions policies", () => {
    expect(header(false, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(header(false, "Permissions-Policy")).toContain("camera=()");
    expect(header(false, "X-Content-Type-Options")).toBe("nosniff");
  });
});
