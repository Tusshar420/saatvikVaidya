import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

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

describe("proxy on the private test site", () => {
  const basic = (user: string, password: string) =>
    `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
  const gated = (path: string, authorization?: string) =>
    new NextRequest(`http://localhost:3000${path}`, { headers: authorization ? { authorization } : {} });

  beforeEach(() => {
    vi.stubEnv("STAGING_ACCESS_PASSWORD", "s3cret-team-pass");
    vi.stubEnv("STAGING_ACCESS_USER", "team");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("asks for the password on every page and API route", () => {
    for (const path of ["/", "/products", "/admin", "/api/auth/get-session"]) {
      const response = proxy(gated(path));
      expect(response.status, path).toBe(401);
      expect(response.headers.get("www-authenticate")).toContain("Basic");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
  });

  it("refuses a wrong user or password", () => {
    for (const header of [basic("team", "wrong"), basic("other", "s3cret-team-pass"), "Basic !!!", "Bearer x", basic("team", "")]) {
      expect(proxy(gated("/", header)).status, header).toBe(401);
    }
  });

  it("lets the team in, marks pages noindex, and still guards signed-in pages", () => {
    const ok = proxy(gated("/products", basic("team", "s3cret-team-pass")));
    expect(ok.headers.get("x-middleware-next")).toBe("1");
    expect(ok.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(proxy(gated("/checkout", basic("team", "s3cret-team-pass"))).status).toBe(307);
  });

  it("allows a password that contains a colon", () => {
    vi.stubEnv("STAGING_ACCESS_PASSWORD", "a:b:c");
    expect(proxy(gated("/", basic("team", "a:b:c"))).headers.get("x-middleware-next")).toBe("1");
  });

  it("is off when no password is set", () => {
    vi.stubEnv("STAGING_ACCESS_PASSWORD", "");
    expect(proxy(gated("/")).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(gated("/")).headers.get("x-robots-tag")).toBeNull();
  });
});
