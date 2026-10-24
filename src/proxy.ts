import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { authCookiePrefix, signInPath } from "@/lib/auth-routes";

/**
 * Sends signed-out visitors of /account, /checkout, /orders, /notifications
 * and /admin to sign-in. Bare /account and /orders are open: they show a
 * sign-in prompt to signed-out visitors (the "You" and "Order" tabs on phones). This only
 * checks that a session cookie is present (fast, no database); pages must
 * still call requireUser() or requireAdmin() from src/server/auth/session.ts,
 * which check the session and role properly.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request, { cookiePrefix: authCookiePrefix })) {
    return NextResponse.next();
  }
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(
    new URL(signInPath(pathname + search), request.url),
  );
}

// Keep in sync with protectedPathPrefixes in src/lib/auth-routes.ts.
export const config = {
  matcher: [
    "/account/:path+",
    "/checkout",
    "/checkout/:path*",
    "/orders/:path+",
    "/notifications",
    "/admin",
    "/admin/:path*",
  ],
};
