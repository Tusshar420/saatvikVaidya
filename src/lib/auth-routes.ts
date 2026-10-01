import { sitePathSchema } from "@/server/content/home-schema";

// Auth-related URLs shared by the proxy, the session helpers and (from A6)
// the sign-in UI.

/** Better Auth's cookie prefix (session cookie: "sv.session_token"). */
export const authCookiePrefix = "sv";

/** Paths that need a signed-in user (checked in src/proxy.ts). */
export const protectedPathPrefixes = ["/account", "/checkout", "/admin"] as const;

/**
 * Where to send a signed-out visitor: the homepage with the sign-in modal
 * open (A6 opens it for `?auth=sign-in`) and where to go back to afterwards.
 */
export function signInPath(next?: string): string {
  const params = new URLSearchParams({ auth: "sign-in" });
  const safeNext = safeNextPath(next);
  if (safeNext) params.set("next", safeNext);
  return `/?${params.toString()}`;
}

/** `next` if it's a path on this site, otherwise null (no open redirects). */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  return sitePathSchema.safeParse(next).success ? next : null;
}
