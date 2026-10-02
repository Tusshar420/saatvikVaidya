import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber } from "better-auth/plugins/phone-number";
import { twoFactor } from "better-auth/plugins/two-factor";
import { site } from "@/content/site";
import { cartMergePlugin } from "@/server/cart/merge";
import { authCookiePrefix } from "@/lib/auth-routes";
import { isIndianE164 } from "@/lib/phone";
import { db } from "@/server/db";
import { authEnv } from "@/server/env";
import {
  sendExistingAccountEmail,
  sendOtpSms,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "@/server/notify/auth";
import { placeholderEmailFor } from "./placeholder-email";
import {
  emailVerificationLinkSeconds,
  otpPolicy,
  passwordPolicy,
  passwordResetLinkSeconds,
} from "./policy";
import { policyPlugin } from "./policy-plugin";
import { prepareNewUser, userAdditionalFields } from "./user-fields";

const env = authEnv();

/**
 * The Better Auth server. HTTP routes are at /api/auth/*; server code uses
 * `auth.api.*` or the helpers in ./session.ts. Our extra rules (validation,
 * rate limits, generic errors) are in ./policy-plugin.ts.
 */
export const auth = betterAuth({
  appName: site.name,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "mysql", transaction: true }),
  telemetry: { enabled: false },
  user: { additionalFields: userAdditionalFields },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: passwordPolicy.minLength,
    maxPasswordLength: passwordPolicy.maxLength,
    // Sign-up never signs in. That way its reply is the same whether or not
    // the email already has an account (the UI signs in next).
    autoSignIn: false,
    onExistingUserSignUp: ({ user }) => sendExistingAccountEmail(user),
    sendResetPassword: ({ user, url }) => sendPasswordResetEmail(user, url),
    resetPasswordTokenExpiresIn: passwordResetLinkSeconds,
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    // Sent from /account ("Verify my email"); the link comes back to it.
    sendVerificationEmail: ({ user, url }) => sendVerificationEmail(user, url),
    expiresIn: emailVerificationLinkSeconds,
  },
  databaseHooks: {
    user: {
      create: {
        before: (user, ctx) => prepareNewUser(user, ctx?.body),
      },
    },
  },
  plugins: [
    phoneNumber({
      otpLength: otpPolicy.length,
      expiresIn: otpPolicy.expiresInSeconds,
      allowedAttempts: otpPolicy.allowedAttempts,
      phoneNumberValidator: isIndianE164,
      sendOTP: ({ phoneNumber, code }) =>
        sendOtpSms(phoneNumber, code, "sign-in"),
      sendPasswordResetOTP: ({ phoneNumber, code }) =>
        sendOtpSms(phoneNumber, code, "password-reset"),
      // A verified OTP for a new number creates the account (the policy
      // plugin makes sure the registration fields are there first).
      signUpOnVerification: {
        getTempEmail: placeholderEmailFor,
        getTempName: (phone) => phone,
      },
    }),
    // Authenticator-app codes (TOTP) with backup codes. Admins must have it
    // (see requireAdmin() in ./session.ts). Email/SMS codes stay off: the
    // second factor must not depend on the same inbox or phone.
    twoFactor({
      issuer: site.name,
      totpOptions: { digits: 6, period: 30 },
      backupCodeOptions: { amount: 8, length: 10 },
    }),
    policyPlugin(),
    // Moves a guest cart into the account at sign-in.
    cartMergePlugin(),
    // Lets server actions set auth cookies. Must stay last.
    nextCookies(),
  ],
  // The limits that matter are in the policy plugin (stored in the
  // database, per phone/email and per IP), so Better Auth's own in-memory
  // limiter is off.
  rateLimit: { enabled: false },
  advanced: {
    cookiePrefix: authCookiePrefix,
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
  },
});

export type Auth = typeof auth;
