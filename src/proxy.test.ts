import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });

describe("proxy", () => {
  it("sends signed-out visitors of protected pages to sign-in", () => {
    for (const [path, next] of [
      ["/account", "%2Faccount"],
      ["/account/orders?page=2", "%2Faccount%2Forders%3Fpage%3D2"],
      ["/checkout", "%2Fcheckout"],
      ["/checkout/pay/abc", "%2Fcheckout%2Fpay%2Fabc"],
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
      const response = proxy(request("/account", cookie));
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("ignores other apps' cookies", () => {
    const response = proxy(request("/account", "better-auth.session_token=x"));
    expect(response.status).toBe(307);
  });

  it("only runs on /account, /checkout and /admin", () => {
    expect(config.matcher).toEqual([
      "/account",
      "/account/:path*",
      "/checkout",
      "/checkout/:path*",
      "/admin",
      "/admin/:path*",
    ]);
  });
});
