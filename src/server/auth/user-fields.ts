import "server-only";
import { APIError } from "better-auth/api";
import type { z } from "zod";
import { authErrors } from "@/content/auth";
import { db } from "@/server/db";
import { registrationSchema } from "./schemas";

/**
 * Our extra columns on User, as Better Auth needs to know them. `input: false`
 * means a client can never set the field: on create Better Auth replaces any
 * value sent with the default, and on update it refuses the request. The
 * create hook below sets them all again anyway.
 */
export const userAdditionalFields = {
  userTypeId: { type: "number", required: true, input: true },
  role: {
    type: ["user", "admin"] as ["user", "admin"],
    required: false,
    defaultValue: "user",
    input: false,
  },
  adminRole: {
    type: ["super", "catalogue", "orders", "content", "approvals"] as [
      "super",
      "catalogue",
      "orders",
      "content",
      "approvals",
    ],
    required: false,
    input: false,
  },
  verificationStatus: {
    type: ["none", "pending", "approved", "rejected"] as [
      "none",
      "pending",
      "approved",
      "rejected",
    ],
    required: false,
    defaultValue: "none",
    input: false,
  },
  marketingOptIn: {
    type: "boolean",
    required: false,
    defaultValue: false,
    input: true,
  },
  termsAcceptedAt: { type: "date", required: false, input: false },
} as const;

export function authError(
  status: "BAD_REQUEST" | "TOO_MANY_REQUESTS",
  code: keyof typeof authErrors,
  headers?: HeadersInit,
): APIError {
  return new APIError(status, { code, message: authErrors[code] }, headers);
}

/** The error for registration fields that don't pass registrationSchema. */
export function registrationError(error: z.ZodError): APIError {
  const termsIssue = error.issues.some(
    (issue) => issue.path[0] === "termsAccepted",
  );
  return authError(
    "BAD_REQUEST",
    termsIssue ? "TERMS_NOT_ACCEPTED" : "INVALID_INPUT",
  );
}

/** The active UserType with this id, or a generic error. */
export async function requireActiveUserType(userTypeId: number) {
  const userType = await db.userType.findFirst({
    where: { id: userTypeId, active: true },
    select: { id: true, requiresVerification: true },
  });
  if (!userType) throw authError("BAD_REQUEST", "INVALID_USER_TYPE");
  return userType;
}

/**
 * Better Auth's `databaseHooks.user.create.before`. Every self-service
 * account (email sign-up, or phone OTP sign-up) is created here, from the
 * request body that the policy plugin already checked:
 * - `userTypeId` must be an active UserType.
 * - `role` is always "user"; admins only come from `pnpm admin:create`.
 * - `verificationStatus` is "pending" for types that need document checks,
 *   otherwise "none".
 * - `termsAcceptedAt` is the server's time, and only if terms were accepted.
 *
 * Anything else (no request, missing fields) is refused.
 */
export async function prepareNewUser(
  user: Record<string, unknown>,
  body: unknown,
): Promise<{ data: Record<string, unknown> }> {
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) throw registrationError(parsed.error);
  const input = parsed.data;
  const userType = await requireActiveUserType(input.userTypeId);
  return {
    data: {
      ...user,
      name: input.name,
      userTypeId: userType.id,
      role: "user",
      verificationStatus: userType.requiresVerification ? "pending" : "none",
      marketingOptIn: input.marketingOptIn,
      termsAcceptedAt: new Date(),
    },
  };
}
