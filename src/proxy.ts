import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { authCookiePrefix, signInPath } from "@/lib/auth-routes";

/**
 * Two jobs, for every page and API route (not the built assets):
 *
 * 1. On the test address (STAGING_ACCESS_PASSWORD set) search engines are
 *    told to stay away: every answer says noindex, and /robots.txt disallows
 *    everything. The team password box that used to guard it was removed on
 *    2026-10-30 at the owner's request; the setting now only marks the test
 *    address (src/server/site-check.ts relies on it too). With it unset (the
 *    live site) this does nothing.
 * 2. Sends signed-out visitors of /account/..., /checkout, /orders/...,
 *    /notifications and /admin to sign-in. Bare /account and /orders are
 *    open: they show a sign-in prompt to signed-out visitors (the "You" and
 *    "Order" tabs on phones). This only checks that a session cookie is
 *    present (fast, no database); pages must still call requireUser() or
 *    requireAdmin() from src/server/auth/session.ts, which check the session
 *    and role properly.
 */

/** Paths that need a session cookie; `bare` is whether the prefix itself does too. */
const protectedPaths = [
  { prefix: "/account", bare: false },
  { prefix: "/checkout", bare: true },
  { prefix: "/orders", bare: false },
  { prefix: "/notifications", bare: true },
  { prefix: "/admin", bare: true },
  // The doctor's course area (B2).
  { prefix: "/doctor", bare: true },
] as const;

// Keep in sync with protectedPathPrefixes in src/lib/auth-routes.ts.
function needsSession(pathname: string): boolean {
  return protectedPaths.some(({ prefix, bare }) =>
    pathname === prefix ? bare : pathname.startsWith(`${prefix}/`),
  );
}

/** What /robots.txt says on the test address: crawl nothing. */
export const testSiteRobots = "User-agent: *\nDisallow: /\n";

export function proxy(request: NextRequest) {
  const testSite = Boolean(process.env.STAGING_ACCESS_PASSWORD);
  if (testSite && request.nextUrl.pathname === "/robots.txt") {
    return new NextResponse(testSiteRobots, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
  const { pathname, search } = request.nextUrl;
  const response =
    !needsSession(pathname) || getSessionCookie(request, { cookiePrefix: authCookiePrefix })
      ? NextResponse.next()
      : NextResponse.redirect(new URL(signInPath(pathname + search), request.url));
  if (testSite) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

// Everything except the built assets and the icon.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
