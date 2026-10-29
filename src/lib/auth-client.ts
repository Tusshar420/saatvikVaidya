import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  phoneNumberClient,
} from "better-auth/client/plugins";
import { authErrors, type AuthErrorCode } from "@/content/auth";
import { signIn as copy } from "@/content/sign-in";
// Type only: gives the client the server's extra user fields. Nothing from
// the server module ends up in the browser bundle.
import type { Auth } from "@/server/auth";

// The browser side of sign-in. Components call the small functions below,
// which return a plain result with an error code and message, so every form
// handles errors the same way. The session itself comes from
// `useAuthSession()`, which refreshes after sign-in and sign-out.

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>(), phoneNumberClient()],
});

export const useAuthSession = authClient.useSession;

export type AuthUser = NonNullable<
  ReturnType<typeof authClient.useSession>["data"]
>["user"];

export type AuthFailure = {
  /** An error code from the server, or NETWORK / UNKNOWN. */
  code: AuthErrorCode | "NETWORK" | "UNKNOWN";
  message: string;
};

export type AuthResult<T> =
  { ok: true; data: T } | { ok: false; error: AuthFailure };

function isKnownCode(code: unknown): code is AuthErrorCode {
  return typeof code === "string" && Object.hasOwn(authErrors, code);
}

/** Our wording for a failed request, with the wait time when rate-limited. */
export function authFailure(
  code: unknown,
  retryAfterSeconds?: number,
): AuthFailure {
  if (code === "NETWORK") return { code, message: copy.errors.network };
  if (!isKnownCode(code))
    return { code: "UNKNOWN", message: copy.errors.generic };
  let message: string = authErrors[code];
  if (code === "RATE_LIMITED" && retryAfterSeconds) {
    message = `${message} ${copy.errors.retryIn(Math.ceil(retryAfterSeconds / 60))}`;
  }
  return { code, message };
}

/** Paths that change who is signed in: the session store refreshes after them. */
const sessionPaths = new Set([
  "/sign-in/email",
  "/phone-number/verify",
  "/reset-password",
]);

/** POSTs to /api/auth{path} and turns the reply into an AuthResult. */
async function post<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<AuthResult<T>> {
  let retryAfter: number | undefined;
  try {
    const { data, error } = await authClient.$fetch<T>(path, {
      method: "POST",
      body,
      onError: ({ response }) => {
        retryAfter = Number(response.headers.get("Retry-After")) || undefined;
      },
    });
    if (error) {
      // Our error bodies carry a `code` (see the policy plugin); the fetch
      // types only know about message and status.
      const code = (error as { code?: unknown }).code;
      return { ok: false, error: authFailure(code, retryAfter) };
    }
    if (sessionPaths.has(path)) authClient.$store.notify("$sessionSignal");
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: authFailure("NETWORK") };
  }
}

export type Registration = {
  name: string;
  userTypeId: number;
  termsAccepted: boolean;
  marketingOptIn: boolean;
};

/** Sends a sign-in code by SMS. `phone` is the 10 national digits. */
export function sendOtp(phone: string) {
  return post<{ message: string }>("/phone-number/send-otp", {
    phoneNumber: `+91${phone}`,
  });
}

export type VerifyOtpReply =
  | { status: true; user: { name: string } }
  | { status: false; registrationRequired: true };

/**
 * Checks a code. A known number is signed in. A new number gets
 * `registrationRequired` (the code stays valid) until the registration
 * details are sent along with the same code.
 */
export function verifyOtp(
  phone: string,
  code: string,
  registration?: Registration,
) {
  return post<VerifyOtpReply>("/phone-number/verify", {
    phoneNumber: `+91${phone}`,
    code,
    ...registration,
  });
}

/** The reply to a password sign-in: signed in, or a second-factor step is next. */
export type EmailSignInReply =
  { user: { name: string }; twoFactorRedirect?: undefined } | { twoFactorRedirect: true };

export function signInWithEmail(email: string, password: string) {
  return post<EmailSignInReply>("/sign-in/email", { email, password });
}

/**
 * Finishes an admin sign-in with an authenticator code or a backup code. The
 * server remembers the password step in a short-lived cookie, so this only
 * works right after signInWithEmail asked for it.
 */
export async function verifyTwoFactor(
  kind: "totp" | "backup",
  code: string,
): Promise<AuthResult<{ user: { name: string } }>> {
  const path =
    kind === "totp" ? "/two-factor/verify-totp" : "/two-factor/verify-backup-code";
  try {
    const { data, error } = await authClient.$fetch<{ user: { name: string } }>(path, {
      method: "POST",
      body: { code },
    });
    if (error) {
      const code = (error as { code?: string }).code ?? "";
      const kindOfFailure =
        error.status === 429
          ? "RATE_LIMITED"
          : code.includes("COOKIE") || code.includes("TOO_MANY_ATTEMPTS")
            ? "TWO_FACTOR_EXPIRED"
            : "TWO_FACTOR_INVALID";
      return { ok: false, error: authFailure(kindOfFailure) };
    }
    authClient.$store.notify("$sessionSignal");
    return { ok: true, data: data as { user: { name: string } } };
  } catch {
    return { ok: false, error: authFailure("NETWORK") };
  }
}

/**
 * Creates an email account, then signs in (sign-up itself never signs in, so
 * its reply doesn't reveal whether the email was already registered).
 */
export async function registerWithEmail(
  email: string,
  password: string,
  registration: Registration,
) {
  const signUp = await post<{ status: true }>("/sign-up/email", {
    email,
    password,
    ...registration,
  });
  if (!signUp.ok) return signUp;
  return signInWithEmail(email, password);
}

export function requestPasswordReset(email: string) {
  return post<{ status: boolean }>("/request-password-reset", {
    email,
    redirectTo: "/reset-password",
  });
}

export function resetPassword(token: string, newPassword: string) {
  return post<{ status: boolean }>("/reset-password", { token, newPassword });
}

export async function signOut(): Promise<AuthResult<null>> {
  try {
    const { error } = await authClient.signOut();
    if (error) return { ok: false, error: authFailure(error.code) };
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: authFailure("NETWORK") };
  }
}
