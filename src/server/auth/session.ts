import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
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

/**
 * The session of an admin. Signed out: redirect to sign-in. Signed in but not
 * an admin: 404, so the admin area doesn't reveal itself.
 */
export async function requireAdmin(returnTo = "/admin"): Promise<AuthSession> {
  const session = await requireUser(returnTo);
  if (session.user.role !== "admin") notFound();
  return session;
}
