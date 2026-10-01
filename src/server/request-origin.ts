import "server-only";
import { headers } from "next/headers";
import { authEnv } from "@/server/env";

/**
 * True when a request comes from the site itself. Upload routes refuse
 * cross-site requests: the session cookie is SameSite=Strict already; this is
 * a second check, like Better Auth's origin check.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(authEnv().BETTER_AUTH_URL).origin;
}

/**
 * The client's IP for rate limits, from x-forwarded-for like Better Auth
 * (src/server/auth/index.ts), or "unknown". See "Later" in docs/PROGRESS.md
 * about trusting the proxy before deploying.
 */
export async function requestIp(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/** True when the site runs over https (cookies get the Secure flag). */
export function isSecureSite(): boolean {
  return new URL(authEnv().BETTER_AUTH_URL).protocol === "https:";
}
