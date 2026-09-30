import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getIP,
  isAPIError,
} from "better-auth/api";
import type { z } from "zod";
import { authErrors, type AuthErrorCode } from "@/content/auth";
import { db } from "@/server/db";
import { isCommonPassword } from "./common-passwords";
import {
  otpPolicy,
  passwordPolicy,
  rateLimitRules,
  type RateLimitRule,
} from "./policy";
import { hitRateLimit } from "./rate-limit";
import {
  authBodySchemas,
  isAuthPath,
  registrationSchema,
  type AuthPath,
} from "./schemas";
import {
  authError,
  registrationError,
  requireActiveUserType,
} from "./user-fields";

// Our rules on top of Better Auth, run before each auth endpoint:
// 1. Rate limits (per IP, then per phone or email for message sends).
// 2. The request body is checked with Zod (src/server/auth/schemas.ts);
//    unknown keys such as `role` are refused, and phone numbers are turned
//    into "+91XXXXXXXXXX".
// 3. New passwords: 8-128 characters and not a common password.
// 4. Sign-up: the user type must be active.
// 5. Phone OTP for a number with no account: see phoneVerify().
// None of these depend on whether an account exists, so errors don't reveal
// that.

/** Endpoints that send an SMS or email. */
const sendPaths = new Set<AuthPath>([
  "/phone-number/send-otp",
  "/phone-number/request-password-reset",
  "/request-password-reset",
]);

/** Endpoints that check a credential or create an account. */
const signInPaths = new Set<AuthPath>([
  "/sign-in/email",
  "/sign-in/phone-number",
  "/sign-up/email",
  "/phone-number/verify",
  "/phone-number/reset-password",
  "/reset-password",
]);

type Body<P extends AuthPath> = z.output<(typeof authBodySchemas)[P]>;

async function enforce(rule: RateLimitRule, subject: string): Promise<void> {
  const result = await hitRateLimit(rule, subject);
  if (!result.allowed) {
    throw authError("TOO_MANY_REQUESTS", "RATE_LIMITED", {
      "Retry-After": String(result.retryAfterSeconds),
    });
  }
}

function parseBody<P extends AuthPath>(path: P, body: unknown): Body<P> {
  const parsed = authBodySchemas[path].safeParse(body ?? {});
  if (parsed.success) return parsed.data as Body<P>;
  const [issue] = parsed.error.issues;
  const field = issue?.path[0];
  if (issue?.message === "INVALID_PHONE_NUMBER" || field === "phoneNumber")
    throw authError("BAD_REQUEST", "INVALID_PHONE_NUMBER");
  if (issue?.message === "INVALID_EMAIL" || field === "email")
    throw authError("BAD_REQUEST", "INVALID_EMAIL");
  if (issue?.message === "TERMS_NOT_ACCEPTED")
    throw authError("BAD_REQUEST", "TERMS_NOT_ACCEPTED");
  throw authError("BAD_REQUEST", "INVALID_INPUT");
}

export function checkNewPassword(password: string): void {
  if (password.length < passwordPolicy.minLength)
    throw authError("BAD_REQUEST", "PASSWORD_TOO_SHORT");
  if (password.length > passwordPolicy.maxLength)
    throw authError("BAD_REQUEST", "PASSWORD_TOO_LONG");
  if (isCommonPassword(password))
    throw authError("BAD_REQUEST", "PASSWORD_TOO_COMMON");
}

function newPasswordOf(path: AuthPath, body: object): string | null {
  if (path === "/sign-up/email" && "password" in body)
    return body.password as string;
  if ("newPassword" in body) return body.newPassword as string;
  return null;
}

type VerificationReader = {
  findVerificationValue(
    identifier: string,
  ): Promise<{ value: string; expiresAt: Date } | null>;
};

/** True if `code` is the live OTP for this phone. Doesn't use it up. */
async function isLiveOtp(
  adapter: VerificationReader,
  phoneNumber: string,
  code: string,
): Promise<boolean> {
  const row = await adapter.findVerificationValue(phoneNumber);
  if (!row || row.expiresAt <= new Date()) return false;
  const [storedCode, rawAttempts] = row.value.split(":");
  const attempts = Number(rawAttempts ?? 0) || 0;
  return attempts < otpPolicy.allowedAttempts && storedCode === code;
}

/**
 * Phone OTP sign-in and sign-up share one endpoint. For a number that has an
 * account, the OTP just signs in (registration fields are dropped). For a new
 * number, the account needs a name, user type and terms:
 * - Wrong, expired or used-up code: Better Auth handles it as usual (the
 *   same errors as for a known number; a wrong code counts as an attempt).
 * - Right code but no registration fields: reply `registrationRequired`
 *   without using up the code, so the UI can ask for them and send the same
 *   code again.
 * - Right code with invalid fields: a validation error, code still unused.
 * - Right code with valid fields: Better Auth creates the account.
 */
async function phoneVerify(
  body: Body<"/phone-number/verify">,
  adapter: VerificationReader,
): Promise<{ body: Record<string, unknown> } | { registrationRequired: true }> {
  const { phoneNumber, code, ...registration } = body;
  const existing = await db.user.findUnique({
    where: { phoneNumber },
    select: { id: true },
  });
  if (existing) return { body: { phoneNumber, code } };
  if (!(await isLiveOtp(adapter, phoneNumber, code))) return { body };

  const hasRegistration = Object.values(registration).some(
    (value) => value !== undefined,
  );
  if (!hasRegistration) return { registrationRequired: true };
  const parsed = registrationSchema.safeParse(registration);
  if (!parsed.success) throw registrationError(parsed.error);
  await requireActiveUserType(parsed.data.userTypeId);
  return { body: { phoneNumber, code, ...parsed.data } };
}

export function policyPlugin() {
  return {
    id: "saatvik-policy",
    hooks: {
      before: [
        {
          matcher: (ctx) => isAuthPath(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            const path = ctx.path as AuthPath;
            const ip =
              getIP(
                ctx.request ?? ctx.headers ?? new Headers(),
                ctx.context.options,
              ) ?? "unknown";

            if (signInPaths.has(path))
              await enforce(rateLimitRules.signInPerIp, ip);
            if (sendPaths.has(path))
              await enforce(rateLimitRules.messageSendPerIp, ip);

            let body: Record<string, unknown> = parseBody(path, ctx.body);

            if (sendPaths.has(path)) {
              if (typeof body.phoneNumber === "string")
                await enforce(rateLimitRules.otpSendPerPhone, body.phoneNumber);
              if (typeof body.email === "string")
                await enforce(rateLimitRules.emailSendPerAddress, body.email);
            }

            const newPassword = newPasswordOf(path, body);
            if (newPassword !== null) checkNewPassword(newPassword);

            if (path === "/sign-up/email")
              await requireActiveUserType(body.userTypeId as number);

            if (path === "/phone-number/verify") {
              const result = await phoneVerify(
                body as Body<"/phone-number/verify">,
                ctx.context.internalAdapter,
              );
              if ("registrationRequired" in result) {
                return ctx.json({
                  status: false,
                  registrationRequired: true,
                  token: null,
                  user: null,
                });
              }
              body = result.body;
            }

            return { context: { body } };
          }),
        },
      ],
      after: [
        {
          // Errors carry our own wording from src/content/auth.ts (same
          // code, status and headers), so every message is plain, never
          // hints at whether an account exists, and can be translated.
          matcher: (ctx) => isAuthPath(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            const error = ctx.context.returned;
            if (!isAPIError(error)) return;
            const code: unknown = error.body?.code;
            if (typeof code !== "string" || !Object.hasOwn(authErrors, code))
              return;
            throw new APIError(
              error.status,
              { code, message: authErrors[code as AuthErrorCode] },
              error.headers,
            );
          }),
        },
        {
          // With autoSignIn off, Better Auth answers a sign-up for an email
          // that already has an account with a made-up user, so the reply
          // doesn't reveal the account. That made-up user can still differ
          // in small ways (such as verificationStatus), so every successful
          // sign-up reply becomes just { status: true }.
          matcher: (ctx) => ctx.path === "/sign-up/email",
          handler: createAuthMiddleware(async (ctx) => {
            if (isAPIError(ctx.context.returned)) return;
            return ctx.json({ status: true });
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
