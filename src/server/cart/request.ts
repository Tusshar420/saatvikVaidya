import "server-only";
import { cookies } from "next/headers";
import { rateLimitRules } from "@/server/auth/policy";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { getSession } from "@/server/auth/session";
import { isSecureSite, requestIp } from "@/server/request-origin";
import type { CartOwner } from "./cart";
import {
  GUEST_CART_COOKIE,
  guestCookieOptions,
  hashGuestToken,
  newGuestToken,
} from "./token";

// Whose cart this request uses: the signed-in user's, otherwise the guest
// cookie's. Pages only read; server actions may start a guest cart.

/** The cart owner for this request, or null for a guest without a cart cookie. */
export async function currentCartOwner(): Promise<CartOwner | null> {
  const session = await getSession();
  if (session) return { kind: "user", userId: session.user.id };
  const tokenHash = hashGuestToken((await cookies()).get(GUEST_CART_COOKIE)?.value);
  return tokenHash ? { kind: "guest", tokenHash } : null;
}

/**
 * For server actions that change the cart. A guest without a cart cookie
 * gets a new one (rate-limited per IP); a guest's cookie is renewed for
 * another 30 days on every change.
 */
export async function cartOwnerForChange(): Promise<CartOwner | "rate_limited"> {
  const session = await getSession();
  if (session) return { kind: "user", userId: session.user.id };

  const jar = await cookies();
  const existing = jar.get(GUEST_CART_COOKIE)?.value;
  const existingHash = hashGuestToken(existing);
  if (existing && existingHash) {
    jar.set(GUEST_CART_COOKIE, existing, guestCookieOptions(isSecureSite()));
    return { kind: "guest", tokenHash: existingHash };
  }

  const limit = await hitRateLimit(rateLimitRules.guestCartPerIp, await requestIp());
  if (!limit.allowed) return "rate_limited";
  const token = newGuestToken();
  jar.set(GUEST_CART_COOKIE, token, guestCookieOptions(isSecureSite()));
  return { kind: "guest", tokenHash: hashGuestToken(token) as string };
}
