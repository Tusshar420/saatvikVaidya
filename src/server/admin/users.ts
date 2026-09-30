import "server-only";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { admin as copy } from "@/content/admin";
import type { Prisma } from "@/generated/prisma/client";
import { toIndianE164 } from "@/lib/phone";
import { newId } from "@/server/auth/admin";
import { isCommonPassword } from "@/server/auth/common-passwords";
import {
  isPlaceholderEmail,
  placeholderEmailFor,
} from "@/server/auth/placeholder-email";
import { passwordPolicy } from "@/server/auth/policy";
import { db } from "@/server/db";
import {
  createdFields,
  diffFields,
  logAdminAction,
  readActivity,
  type ActivityItem,
} from "./audit";
import { blankToNull, checkbox } from "./form";

// User management for the admin panel: list and search, detail, create,
// edit, approve/reject and delete. Callers (server actions) check the admin
// session first and pass the admin's id as `actorId`.

export const verificationStatuses = [
  "none",
  "pending",
  "approved",
  "rejected",
] as const;
export type VerificationStatus = (typeof verificationStatuses)[number];

export const userRoles = ["user", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const USERS_PAGE_SIZE = 25;

/** The most ids one bulk action may touch. */
export const BULK_LIMIT = 100;

// ─── List ───────────────────────────────────────────────────────────────────

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

/**
 * Filters from the users page URL. Anything invalid is dropped rather than
 * failing, so a bad link still shows the list.
 */
export const userFiltersSchema = z.object({
  q: z.preprocess(first, z.string().trim().max(100).optional()).catch(undefined),
  type: z
    .preprocess(first, z.string().regex(/^[a-z0-9_-]{1,40}$/).optional())
    .catch(undefined),
  status: z
    .preprocess(first, z.enum(verificationStatuses).optional())
    .catch(undefined),
  role: z.preprocess(first, z.enum(userRoles).optional()).catch(undefined),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000)).catch(1),
});

export type UserFilters = z.infer<typeof userFiltersSchema>;

export type UserRow = {
  id: string;
  name: string;
  /** Null for phone-only accounts (their placeholder email is never shown). */
  email: string | null;
  phoneNumber: string | null;
  userTypeKey: string;
  userTypeLabel: string;
  requiresVerification: boolean;
  role: UserRole;
  verificationStatus: VerificationStatus;
  createdAt: Date;
};

const rowSelect = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  role: true,
  verificationStatus: true,
  createdAt: true,
  userType: { select: { key: true, label: true, requiresVerification: true } },
} satisfies Prisma.UserSelect;

type RowRecord = Prisma.UserGetPayload<{ select: typeof rowSelect }>;

function toRow(user: RowRecord): UserRow {
  return {
    id: user.id,
    name: user.name,
    email: isPlaceholderEmail(user.email) ? null : user.email,
    phoneNumber: user.phoneNumber,
    userTypeKey: user.userType.key,
    userTypeLabel: user.userType.label,
    requiresVerification: user.userType.requiresVerification,
    role: user.role,
    verificationStatus: user.verificationStatus,
    createdAt: user.createdAt,
  };
}

function searchWhere(q: string | undefined): Prisma.UserWhereInput {
  if (!q) return {};
  const or: Prisma.UserWhereInput[] = [
    { name: { contains: q } },
    { email: { contains: q } },
  ];
  // Phone numbers are stored as +91XXXXXXXXXX; match typed digits in them.
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3) {
    const national =
      digits.length > 10 && digits.startsWith("91") ? digits.slice(2) : digits;
    or.push({ phoneNumber: { contains: national } });
  }
  return { OR: or };
}

export async function listUsers(filters: UserFilters): Promise<{
  rows: UserRow[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const where: Prisma.UserWhereInput = {
    ...searchWhere(filters.q),
    userType: filters.type ? { key: filters.type } : undefined,
    verificationStatus: filters.status,
    role: filters.role,
  };
  const total = await db.user.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const users = await db.user.findMany({
    where,
    select: rowSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * USERS_PAGE_SIZE,
    take: USERS_PAGE_SIZE,
  });
  return { rows: users.map(toRow), total, page, pageCount };
}

/** Professional accounts waiting for a decision, oldest first. */
export async function listPendingApprovals(): Promise<UserRow[]> {
  const users = await db.user.findMany({
    where: {
      verificationStatus: "pending",
      userType: { requiresVerification: true },
    },
    select: rowSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
  });
  return users.map(toRow);
}

export type UserTypeOption = {
  id: number;
  key: string;
  label: string;
  requiresVerification: boolean;
  active: boolean;
};

export async function listUserTypes(): Promise<UserTypeOption[]> {
  return db.userType.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      key: true,
      label: true,
      requiresVerification: true,
      active: true,
    },
  });
}

// ─── Detail ─────────────────────────────────────────────────────────────────

export type UserDetail = UserRow & {
  userTypeId: number;
  emailVerified: boolean;
  phoneNumberVerified: boolean;
  marketingOptIn: boolean;
  termsAcceptedAt: Date;
  hasPassword: boolean;
  history: ActivityItem[];
};

export async function getUserDetail(id: string): Promise<UserDetail | null> {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      ...rowSelect,
      userTypeId: true,
      emailVerified: true,
      phoneNumberVerified: true,
      marketingOptIn: true,
      termsAcceptedAt: true,
      // Only whether a password exists, never the hash.
      accounts: { where: { providerId: "credential" }, select: { id: true } },
    },
  });
  if (!user) return null;
  const history = await readActivity({
    resource: "User",
    resourceId: id,
    take: 20,
  });
  return {
    ...toRow(user),
    userTypeId: user.userTypeId,
    emailVerified: isPlaceholderEmail(user.email) ? false : user.emailVerified,
    phoneNumberVerified: user.phoneNumberVerified,
    marketingOptIn: user.marketingOptIn,
    termsAcceptedAt: user.termsAcceptedAt,
    hasPassword: user.accounts.length > 0,
    history,
  };
}

// ─── Create and edit ────────────────────────────────────────────────────────

const errors = copy.userForm.errors;

/** Fields shared by the add and edit forms. */
export const userInputSchema = z
  .object({
    name: z
      .string({ error: errors.name })
      .trim()
      .min(2, errors.name)
      .max(80, errors.name),
    email: z.preprocess(
      blankToNull,
      z
        .string({ error: errors.email })
        .trim()
        .toLowerCase()
        .max(191, errors.email)
        .pipe(z.email({ error: errors.email }))
        .refine((email) => !isPlaceholderEmail(email), errors.email)
        .nullable(),
    ),
    phone: z.preprocess(
      blankToNull,
      z
        .string({ error: errors.phone })
        .max(32, errors.phone)
        .transform((value, ctx) => {
          const e164 = toIndianE164(value);
          if (!e164) {
            ctx.addIssue({ code: "custom", message: errors.phone });
            return z.NEVER;
          }
          return e164;
        })
        .nullable(),
    ),
    userTypeId: z.coerce
      .number({ error: errors.userType })
      .int(errors.userType)
      .positive(errors.userType),
    role: z.enum(userRoles, { error: errors.userType }),
    verificationStatus: z.enum(verificationStatuses),
    marketingOptIn: checkbox,
    password: z.preprocess(
      (value) => (value === undefined || value === "" ? null : value),
      z.string().max(passwordPolicy.maxLength, errors.password).nullable(),
    ),
  })
  .refine((input) => input.email !== null || input.phone !== null, {
    path: ["email"],
    message: errors.contactRequired,
  })
  .transform(({ phone, ...input }) => ({ ...input, phoneNumber: phone }));

export type UserInput = z.infer<typeof userInputSchema>;

export type UserResult =
  | { ok: true; id: string }
  | { ok: false; fieldErrors: Record<string, string> };

/** Customers are always "none"; professional types can't be "none". */
function statusForType(
  status: VerificationStatus,
  requiresVerification: boolean,
): VerificationStatus {
  if (!requiresVerification) return "none";
  return status === "none" ? "pending" : status;
}

function passwordProblem(password: string, role: UserRole): string | null {
  const min =
    role === "admin" ? passwordPolicy.adminMinLength : passwordPolicy.minLength;
  if (password.length < min || isCommonPassword(password)) {
    return role === "admin"
      ? errors.adminPassword(passwordPolicy.adminMinLength)
      : errors.password;
  }
  return null;
}

async function contactConflicts(
  tx: Prisma.TransactionClient,
  input: { email: string; phoneNumber: string | null },
  exceptId?: string,
): Promise<Record<string, string>> {
  const conflicts: Record<string, string> = {};
  const byEmail = await tx.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (byEmail && byEmail.id !== exceptId) {
    // A placeholder email clash means the phone is taken.
    if (isPlaceholderEmail(input.email)) conflicts.phone = errors.phoneTaken;
    else conflicts.email = errors.emailTaken;
  }
  if (input.phoneNumber) {
    const byPhone = await tx.user.findUnique({
      where: { phoneNumber: input.phoneNumber },
      select: { id: true },
    });
    if (byPhone && byPhone.id !== exceptId) conflicts.phone = errors.phoneTaken;
  }
  return conflicts;
}

async function userTypeOrError(
  tx: Prisma.TransactionClient,
  userTypeId: number,
): Promise<{ id: number; requiresVerification: boolean } | null> {
  return tx.userType.findFirst({
    where: { id: userTypeId, active: true },
    select: { id: true, requiresVerification: true },
  });
}

/** Loggable fields of a user (no secrets). */
function auditView(user: {
  name: string;
  email: string;
  phoneNumber: string | null;
  userTypeId: number;
  role: string;
  verificationStatus: string;
  marketingOptIn: boolean;
}) {
  return {
    name: user.name,
    email: isPlaceholderEmail(user.email) ? null : user.email,
    phoneNumber: user.phoneNumber,
    userTypeId: user.userTypeId,
    role: user.role,
    verificationStatus: user.verificationStatus,
    marketingOptIn: user.marketingOptIn,
  };
}

/**
 * Creates an account. Without an email the account gets the phone
 * placeholder email, like a phone sign-up. With a password it can also sign in
 * by email/phone + password.
 */
export async function createUser(
  input: UserInput,
  actorId: string,
): Promise<UserResult> {
  if (input.password) {
    const problem = passwordProblem(input.password, input.role);
    if (problem) return { ok: false, fieldErrors: { password: problem } };
  } else if (input.role === "admin") {
    return {
      ok: false,
      fieldErrors: {
        password: errors.adminPassword(passwordPolicy.adminMinLength),
      },
    };
  }
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : null;

  return db.$transaction(async (tx) => {
    const type = await userTypeOrError(tx, input.userTypeId);
    if (!type) return { ok: false, fieldErrors: { userTypeId: errors.userType } };

    // The schema guarantees an email or a phone number.
    const email = input.email ?? placeholderEmailFor(input.phoneNumber ?? "");
    const conflicts = await contactConflicts(tx, {
      email,
      phoneNumber: input.phoneNumber,
    });
    if (Object.keys(conflicts).length) return { ok: false, fieldErrors: conflicts };

    const id = newId();
    const data = {
      name: input.name,
      email,
      phoneNumber: input.phoneNumber,
      userTypeId: type.id,
      role: input.role,
      verificationStatus: statusForType(
        input.verificationStatus,
        type.requiresVerification,
      ),
      marketingOptIn: input.marketingOptIn,
    };
    await tx.user.create({
      data: {
        id,
        ...data,
        // Required column; the person accepts the terms when they sign in.
        termsAcceptedAt: new Date(),
        accounts: passwordHash
          ? {
              create: {
                id: newId(),
                accountId: id,
                providerId: "credential",
                password: passwordHash,
              },
            }
          : undefined,
      },
    });
    await logAdminAction(tx, {
      actorId,
      action: "user.create",
      resource: "User",
      resourceId: id,
      changes: {
        ...createdFields(auditView(data)),
        ...(passwordHash ? { password: { from: null, to: "set" } } : {}),
      },
    });
    return { ok: true, id };
  });
}

/**
 * Saves the edit form. Changing the email or phone marks it unverified.
 * Changing the role signs the user out everywhere. An admin can't remove
 * their own admin role.
 */
export async function updateUser(
  id: string,
  input: UserInput,
  actorId: string,
): Promise<UserResult | null> {
  if (id === actorId && input.role !== "admin") {
    return { ok: false, fieldErrors: { role: errors.selfRole } };
  }
  return db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id } });
    if (!existing) return null;

    const type = await userTypeOrError(tx, input.userTypeId);
    if (!type) return { ok: false, fieldErrors: { userTypeId: errors.userType } };

    const email = input.email ?? placeholderEmailFor(input.phoneNumber ?? "");
    const conflicts = await contactConflicts(
      tx,
      { email, phoneNumber: input.phoneNumber },
      id,
    );
    if (Object.keys(conflicts).length) return { ok: false, fieldErrors: conflicts };

    const data = {
      name: input.name,
      email,
      phoneNumber: input.phoneNumber,
      userTypeId: type.id,
      role: input.role,
      verificationStatus: statusForType(
        input.verificationStatus,
        type.requiresVerification,
      ),
      marketingOptIn: input.marketingOptIn,
    };
    const changes = diffFields(auditView(existing), auditView(data));
    if (Object.keys(changes).length === 0) return { ok: true, id };

    await tx.user.update({
      where: { id },
      data: {
        ...data,
        emailVerified: email === existing.email ? undefined : false,
        phoneNumberVerified:
          data.phoneNumber === existing.phoneNumber ? undefined : false,
      },
    });
    if (data.role !== existing.role) {
      await tx.session.deleteMany({ where: { userId: id } });
    }
    await logAdminAction(tx, {
      actorId,
      action: "user.update",
      resource: "User",
      resourceId: id,
      changes,
    });
    return { ok: true, id };
  });
}

// ─── Approve, reject, delete ────────────────────────────────────────────────

export const userIdsSchema = z
  .array(z.string().trim().min(1).max(64))
  .min(1)
  .max(BULK_LIMIT);

export const noteSchema = z.preprocess(
  blankToNull,
  z.string().trim().max(500).nullable(),
);

/**
 * Sets the verification decision on users whose type needs verification;
 * others are skipped. One audit row per changed user.
 */
export async function decideVerification(
  ids: string[],
  decision: "approved" | "rejected",
  note: string | null,
  actorId: string,
): Promise<{ changed: number; skipped: number }> {
  const unique = [...new Set(ids)].slice(0, BULK_LIMIT);
  return db.$transaction(async (tx) => {
    const users = await tx.user.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        verificationStatus: true,
        userType: { select: { requiresVerification: true } },
      },
    });
    let changed = 0;
    for (const user of users) {
      if (!user.userType.requiresVerification) continue;
      await tx.user.update({
        where: { id: user.id },
        data: { verificationStatus: decision },
      });
      await logAdminAction(tx, {
        actorId,
        action: decision === "approved" ? "user.approve" : "user.reject",
        resource: "User",
        resourceId: user.id,
        changes: diffFields(
          { verificationStatus: user.verificationStatus },
          { verificationStatus: decision },
        ),
        note,
      });
      changed += 1;
    }
    return { changed, skipped: unique.length - changed };
  });
}

/**
 * Deletes users with their sessions and sign-in details. The acting admin's
 * own account is never deleted (it's counted as skipped).
 */
export async function deleteUsers(
  ids: string[],
  actorId: string,
): Promise<{ changed: number; skipped: number }> {
  const unique = [...new Set(ids)].slice(0, BULK_LIMIT);
  const deletable = unique.filter((id) => id !== actorId);
  return db.$transaction(async (tx) => {
    const users = await tx.user.findMany({
      where: { id: { in: deletable } },
      select: {
        id: true,
        name: true,
        role: true,
        userType: { select: { key: true } },
      },
    });
    for (const user of users) {
      await logAdminAction(tx, {
        actorId,
        action: "user.delete",
        resource: "User",
        resourceId: user.id,
        changes: createdFields({
          name: user.name,
          userType: user.userType.key,
          role: user.role,
        }),
      });
    }
    // Sessions and accounts go with their users (onDelete: Cascade).
    const { count } = await tx.user.deleteMany({
      where: { id: { in: users.map((user) => user.id) } },
    });
    return { changed: count, skipped: unique.length - count };
  });
}
