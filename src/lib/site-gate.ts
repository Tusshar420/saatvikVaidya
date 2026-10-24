import { createHash, timingSafeEqual } from "node:crypto";

// A shared password for the whole site, used on the private test address so
// only the team can open it. Set STAGING_ACCESS_USER and
// STAGING_ACCESS_PASSWORD on that server only; on the live site they stay
// unset and there is no gate. It is plain HTTP Basic authentication, so it
// is only safe over https (the test address must have the padlock).

export type SiteGate = { user: string; password: string };

/** The gate from the environment, or null when it is off (no password set). */
export function siteGateFromEnv(env: Partial<Record<string, string>> = process.env): SiteGate | null {
  const password = env.STAGING_ACCESS_PASSWORD;
  if (!password) return null;
  return { user: env.STAGING_ACCESS_USER || "team", password };
}

/** Hash both sides so the comparison takes the same time whatever the length. */
function same(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** True if an `Authorization: Basic ...` header carries the gate's user and password. */
export function gatePasses(header: string | null, gate: SiteGate): boolean {
  if (!header?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
  } catch {
    return false;
  }
  const split = decoded.indexOf(":");
  if (split < 0) return false;
  // Both are checked, so a wrong user and a wrong password look the same.
  const userOk = same(decoded.slice(0, split), gate.user);
  const passwordOk = same(decoded.slice(split + 1), gate.password);
  return userOk && passwordOk;
}
