import "server-only";
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
