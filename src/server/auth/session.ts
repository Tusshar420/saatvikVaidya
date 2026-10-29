import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { roleCanAccess, type AdminArea } from "@/lib/admin-permissions";
import { signInPath } from "@/lib/auth-routes";
import { auth } from "./index";

export type AuthSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

/**
 * The signed-in user and session for this request, or null. Checked against
 * the database (no cookie cache), so a changed role or a revoked session
 * applies straight away. Cached per request.
 */
export const getSession = cache(async (): Promise<AuthSession | null> => {
  return auth.api.getSession({ headers: await headers() });
});

/** The session, or a redirect to sign-in that comes back to `returnTo`. */
export async function requireUser(returnTo = "/account"): Promise<AuthSession> {
  const session = await getSession();
  if (!session) redirect(signInPath(returnTo));
  return session;
}

/** Where an admin without two-factor is sent to set it up. */
export const twoFactorSetupPath = "/account/two-factor";

/**
 * The admin checks, in order: an admin account, two-factor set up, and the
 * admin's role allowed for `area`. Null means "refuse"; `needsTwoFactor`
 * tells pages to send the admin to set it up instead of showing a 404.
 */
export function adminAccess(
  session: AuthSession | null,
  area: AdminArea,
): "ok" | "needs-two-factor" | "refused" {
  if (!session || session.user.role !== "admin") return "refused";
  if (!session.user.twoFactorEnabled) return "needs-two-factor";
  return roleCanAccess(session.user.adminRole, area) ? "ok" : "refused";
}

/**
 * The session of an admin who may use `area`. Signed out: redirect to
 * sign-in. Not an admin, or an admin whose role doesn't cover the area: 404,
 * so the admin area doesn't reveal itself. An admin who hasn't set up
 * two-factor yet: redirect to the setup page, so no admin page loads before
 * it. Every admin page, server action and route handler calls this itself;
 * the menu only hides what is refused here.
 */
export async function requireAdmin(
  area: AdminArea = "dashboard",
  returnTo = "/admin",
): Promise<AuthSession> {
  const session = await requireUser(returnTo);
  const access = adminAccess(session, area);
  if (access === "needs-two-factor") redirect(twoFactorSetupPath);
  if (access !== "ok") notFound();
  return session;
}

/**
 * "admin" if this session may use `area` as an admin (two-factor set up and
 * a role that covers it), otherwise "user". For the viewer checks in server
 * code that only knows "admin" or not (invoice, document and ebook access).
 */
export function effectiveRole(
  session: AuthSession | null,
  area: AdminArea,
): "admin" | "user" {
  return adminAccess(session, area) === "ok" ? "admin" : "user";
}

/**
 * For route handlers: the admin's session if they may use `area`, otherwise
 * null (the handler answers 404). Two-factor is checked the same way.
 */
export async function getAdminSession(
  area: AdminArea,
): Promise<AuthSession | null> {
  const session = await getSession();
  return session && adminAccess(session, area) === "ok" ? session : null;
}
