import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy, testSiteRobots } from "./proxy";

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });

describe("proxy", () => {
  it("sends signed-out visitors of protected pages to sign-in", () => {
    for (const [path, next] of [
      ["/account/orders?page=2", "%2Faccount%2Forders%3Fpage%3D2"],
      ["/checkout", "%2Fcheckout"],
      ["/checkout/pay/abc", "%2Fcheckout%2Fpay%2Fabc"],
      ["/orders/abc", "%2Forders%2Fabc"],
      ["/admin", "%2Fadmin"],
      ["/admin/users/42", "%2Fadmin%2Fusers%2F42"],
    ]) {
      const response = proxy(request(path!));
      expect(response.status, path).toBe(307);
      expect(response.headers.get("location")).toBe(
        `http://localhost:3000/?auth=sign-in&next=${next}`,
      );
    }
  });

  it("lets requests with a session cookie through (pages check it fully)", () => {
    for (const cookie of [
      "sv.session_token=abc.def",
      "__Secure-sv.session_token=abc.def",
    ]) {
      const response = proxy(request("/account/addresses", cookie));
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("ignores other apps' cookies", () => {
    const response = proxy(request("/account/addresses", "better-auth.session_token=x"));
    expect(response.status).toBe(307);
  });

  it("leaves public pages alone, and bare /account and /orders open", () => {
    for (const path of ["/", "/products", "/account", "/orders", "/accountant", "/api/auth/get-session"]) {
      const response = proxy(request(path));
      expect(response.headers.get("x-middleware-next"), path).toBe("1");
    }
    expect(proxy(request("/notifications")).status).toBe(307);
  });

  it("skips the built assets", () => {
    expect(config.matcher).toEqual(["/((?!_next/static|_next/image|favicon.ico).*)"]);
  });
});

describe("proxy on the test site", () => {
  beforeEach(() => {
    vi.stubEnv("STAGING_ACCESS_PASSWORD", "s3cret-team-pass");
    vi.stubEnv("STAGING_ACCESS_USER", "team");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("opens every page without a password box, marked noindex", () => {
    for (const path of ["/", "/products", "/api/auth/get-session"]) {
      const response = proxy(request(path));
      expect(response.headers.get("x-middleware-next"), path).toBe("1");
      expect(response.headers.get("www-authenticate"), path).toBeNull();
      expect(response.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
    }
  });

  it("still guards signed-in pages", () => {
    expect(proxy(request("/checkout")).status).toBe(307);
  });

  it("tells crawlers to stay away in /robots.txt", async () => {
    const response = proxy(request("/robots.txt"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await response.text()).toBe(testSiteRobots);
    expect(testSiteRobots).toMatch(/^User-agent: \*\nDisallow: \/$/m);
  });

  it("does nothing extra on the live site (setting unset)", () => {
    vi.stubEnv("STAGING_ACCESS_PASSWORD", "");
    expect(proxy(request("/")).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(request("/")).headers.get("x-robots-tag")).toBeNull();
    // The live site's /robots.txt is left to the app (no "Disallow: /").
    expect(proxy(request("/robots.txt")).headers.get("x-middleware-next")).toBe("1");
  });
});
