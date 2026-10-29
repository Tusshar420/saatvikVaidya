import { createHash, randomBytes } from "node:crypto";

// The guest cart cookie. It holds a random token; the database keeps only
// the token's SHA-256, so a leaked database row can't be turned back into a
// working cookie. No "server-only" import: the auth plugin that merges carts
// at sign-in uses this too.

export const GUEST_CART_COOKIE = "sv.cart";

/** Guest carts last 30 days from the last change. */
export const GUEST_CART_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** 32 random bytes, base64url (43 characters). */
export function newGuestToken(): string {
  return randomBytes(32).toString("base64url");
}

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

/** The stored hash for a cookie value, or null if it isn't a token we made. */
export function hashGuestToken(token: string | undefined | null): string | null {
  if (!token || !tokenPattern.test(token)) return null;
  return createHash("sha256").update(token).digest("hex");
}

/** HttpOnly, SameSite=Lax (so it's sent when arriving from a link), Secure on https. */
export function guestCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: GUEST_CART_MAX_AGE_SECONDS,
  };
}
