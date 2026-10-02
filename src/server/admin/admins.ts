import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { adminSecurity as copy } from "@/content/admin-security";
import { adminRoles, type AdminRoleKey } from "@/lib/admin-permissions";
import { db } from "@/server/db";
import { authEnv } from "@/server/env";
import { newId } from "@/server/auth/admin";
import { isCommonPassword } from "@/server/auth/common-passwords";
import { passwordPolicy } from "@/server/auth/policy";
import { emailSchema, nameSchema } from "@/server/auth/schemas";
import { getNotifier } from "@/server/notify";
import { logAdminAction } from "./audit";

// Managing admin accounts (P1.11): invites, roles, two-factor resets and
// removal. Super admins only (the actions check the "admins" area). Admins
// are never self-registered: the only ways to become one are an invite from
// here and `pnpm admin:create`.

/** How long an invitation link works. */
export const inviteHours = 72;

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(adminRoles, { error: copy.errors.invalidRole }),
});

export type Failure = { ok: false; error: string; field?: string };
export type Done<T = object> = { ok: true } & T;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

// ─── Reading ────────────────────────────────────────────────────────────────

export type AdminRow = {
  id: string;
  name: string;
  email: string;
  adminRole: AdminRoleKey | null;
  twoFactorEnabled: boolean;
};

export async function listAdmins(): Promise<AdminRow[]> {
  const rows = await db.user.findMany({
    where: { role: "admin" },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      adminRole: true,
      twoFactorEnabled: true,
    },
  });
  return rows;
}

export type PendingInvite = {
  id: number;
  email: string;
  adminRole: AdminRoleKey;
  expiresAt: Date;
};

export async function listPendingInvites(): Promise<PendingInvite[]> {
  return db.adminInvite.findMany({
    where: { acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, adminRole: true, expiresAt: true },
  });
}

// ─── Invites ────────────────────────────────────────────────────────────────

/**
 * Sends an invitation. A new invitation for the same email replaces the old
 * one. Refused if the email already has an account (an account can't be
 * turned into an admin by an invite).
 */
export async function inviteAdmin(
  input: { email: string; role: string },
  actor: { id: string; name: string },
): Promise<Done | Failure> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "email");
    return {
      ok: false,
      field,
      error:
        field === "role" ? copy.errors.invalidRole : copy.errors.invalidEmail,
    };
  }
  const { email, role } = parsed.data;
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, field: "email", error: copy.errors.hasAccount };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + inviteHours * 3600 * 1000);
  await db.$transaction(async (tx) => {
    await tx.adminInvite.deleteMany({ where: { email, acceptedAt: null } });
    const invite = await tx.adminInvite.create({
      data: {
        email,
        adminRole: role,
        tokenHash: hashToken(token),
        invitedById: actor.id,
        expiresAt,
      },
    });
    await logAdminAction(tx, {
      actorId: actor.id,
      action: "admin.invite",
      resource: "AdminInvite",
      resourceId: invite.id,
      changes: {
        email: { from: null, to: email },
        adminRole: { from: null, to: role },
      },
    });
  });

  const url = `${authEnv().BETTER_AUTH_URL}/admin-invite/${token}`;
  await getNotifier().send({
    channel: "email",
    to: email,
    subject: copy.invite.emailSubject,
    text: copy.invite.emailBody(actor.name, copy.roles[role], url, inviteHours),
  });
  return { ok: true };
}

export async function revokeInvite(
  id: number,
  actorId: string,
): Promise<Done | Failure> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.adminInvite.deleteMany({
      where: { id, acceptedAt: null },
    });
    if (count === 0) return { ok: false, error: copy.errors.inviteInvalid };
    await logAdminAction(tx, {
      actorId,
      action: "admin.invite.revoke",
      resource: "AdminInvite",
      resourceId: id,
    });
    return { ok: true };
  });
}

/** The role an invitation grants, if the link is live; otherwise null. */
export async function findLiveInvite(
  token: string,
): Promise<{ email: string; adminRole: AdminRoleKey } | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  return db.adminInvite.findFirst({
    where: {
      tokenHash: hashToken(token),
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { email: true, adminRole: true },
  });
}

export const acceptInviteSchema = z
  .object({
    name: nameSchema,
    password: z.string().max(passwordPolicy.maxLength),
    confirm: z.string().max(passwordPolicy.maxLength),
  })
  .superRefine((value, ctx) => {
    if (
      value.password.length < passwordPolicy.adminMinLength ||
      isCommonPassword(value.password)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: copy.errors.password(passwordPolicy.adminMinLength),
      });
    } else if (value.password !== value.confirm) {
      ctx.addIssue({
        code: "custom",
        path: ["confirm"],
        message: copy.errors.passwordMismatch,
      });
    }
  });

/**
 * Turns a live invitation into an admin account (email counts as verified:
 * the link went to it). The invite is used up in the same transaction, so a
 * link can't make two accounts. Two-factor is set up at first sign-in.
 */
export async function acceptInvite(
  token: string,
  input: { name: string; password: string; confirm: string },
): Promise<Done | Failure> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      field: String(issue?.path[0] ?? "name"),
      error: issue?.message ?? copy.errors.generic,
    };
  }
  const invite = await findLiveInvite(token);
  if (!invite) return { ok: false, error: copy.errors.inviteInvalid };
  const customer = await db.userType.findUnique({
    where: { key: "customer" },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: copy.errors.generic };
  const passwordHash = await hashPassword(parsed.data.password);

  return db.$transaction<Done | Failure>(async (tx) => {
    // Atomic: only one request can flip acceptedAt from null.
    const used = await tx.adminInvite.updateMany({
      where: {
        tokenHash: hashToken(token),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { acceptedAt: new Date() },
    });
    if (used.count !== 1) return { ok: false, error: copy.errors.inviteInvalid };
    if (
      await tx.user.findUnique({
        where: { email: invite.email },
        select: { id: true },
      })
    ) {
      // Someone registered this email since the invite: nothing is created.
      throw new InviteConflict();
    }
    const id = newId();
    await tx.user.create({
      data: {
        id,
        name: parsed.data.name,
        email: invite.email,
        emailVerified: true,
        role: "admin",
        adminRole: invite.adminRole,
        userTypeId: customer.id,
        termsAcceptedAt: new Date(),
        accounts: {
          create: {
            id: newId(),
            accountId: id,
            providerId: "credential",
            password: passwordHash,
          },
        },
      },
    });
    await logAdminAction(tx, {
      actorId: id,
      action: "admin.invite.accept",
      resource: "Admin",
      resourceId: id,
      changes: {
        email: { from: null, to: invite.email },
        adminRole: { from: null, to: invite.adminRole },
      },
    });
    return { ok: true };
  }).catch((error: unknown): Failure => {
    if (error instanceof InviteConflict) {
      return { ok: false, error: copy.errors.inviteInvalid };
    }
    throw error;
  });
}

class InviteConflict extends Error {}

// ─── Existing admins ────────────────────────────────────────────────────────

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** True if `id` is the only super admin left. */
async function isLastSuper(tx: Tx, id: string): Promise<boolean> {
  const supers = await tx.user.findMany({
    where: { role: "admin", adminRole: "super" },
    select: { id: true },
  });
  return supers.length === 1 && supers[0]?.id === id;
}

async function findAdmin(tx: Tx, id: string) {
  return tx.user.findFirst({
    where: { id, role: "admin" },
    select: { id: true, adminRole: true, twoFactorEnabled: true },
  });
}

export async function changeAdminRole(
  id: string,
  role: string,
  actorId: string,
): Promise<Done | Failure> {
  const parsed = z.enum(adminRoles).safeParse(role);
  if (!parsed.success) return { ok: false, error: copy.errors.invalidRole };
  if (id === actorId) return { ok: false, error: copy.errors.self };
  return db.$transaction(async (tx) => {
    const admin = await findAdmin(tx, id);
    if (!admin) return { ok: false, error: copy.errors.notAdmin };
    if (admin.adminRole === parsed.data) return { ok: true };
    if (admin.adminRole === "super" && (await isLastSuper(tx, id))) {
      return { ok: false, error: copy.errors.lastSuper };
    }
    await tx.user.update({ where: { id }, data: { adminRole: parsed.data } });
    // Signed out so the new permissions apply from the next sign-in.
    await tx.session.deleteMany({ where: { userId: id } });
    await logAdminAction(tx, {
      actorId,
      action: "admin.role.update",
      resource: "Admin",
      resourceId: id,
      changes: { adminRole: { from: admin.adminRole, to: parsed.data } },
    });
    return { ok: true };
  });
}

/** Clears an admin's authenticator so they set it up again at next sign-in. */
export async function resetAdminTwoFactor(
  id: string,
  actorId: string,
): Promise<Done | Failure> {
  if (id === actorId) return { ok: false, error: copy.errors.self };
  return db.$transaction(async (tx) => {
    const admin = await findAdmin(tx, id);
    if (!admin) return { ok: false, error: copy.errors.notAdmin };
    await tx.twoFactor.deleteMany({ where: { userId: id } });
    await tx.user.update({ where: { id }, data: { twoFactorEnabled: false } });
    await tx.session.deleteMany({ where: { userId: id } });
    await logAdminAction(tx, {
      actorId,
      action: "admin.2fa.reset",
      resource: "Admin",
      resourceId: id,
      changes: { twoFactorEnabled: { from: admin.twoFactorEnabled, to: false } },
    });
    return { ok: true };
  });
}

/** Turns an admin back into an ordinary customer account. */
export async function removeAdmin(
  id: string,
  actorId: string,
): Promise<Done | Failure> {
  if (id === actorId) return { ok: false, error: copy.errors.self };
  return db.$transaction(async (tx) => {
    const admin = await findAdmin(tx, id);
    if (!admin) return { ok: false, error: copy.errors.notAdmin };
    if (admin.adminRole === "super" && (await isLastSuper(tx, id))) {
      return { ok: false, error: copy.errors.lastSuper };
    }
    await tx.twoFactor.deleteMany({ where: { userId: id } });
    await tx.user.update({
      where: { id },
      data: { role: "user", adminRole: null, twoFactorEnabled: false },
    });
    await tx.session.deleteMany({ where: { userId: id } });
    await logAdminAction(tx, {
      actorId,
      action: "admin.remove",
      resource: "Admin",
      resourceId: id,
      changes: {
        role: { from: "admin", to: "user" },
        adminRole: { from: admin.adminRole, to: null },
      },
    });
    return { ok: true };
  });
}
