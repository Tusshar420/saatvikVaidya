import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber } from "better-auth/plugins/phone-number";
import { site } from "@/content/site";
import { authCookiePrefix } from "@/lib/auth-routes";
import { isIndianE164 } from "@/lib/phone";
import { db } from "@/server/db";
import { authEnv } from "@/server/env";
import {
  sendExistingAccountEmail,
  sendOtpSms,
  sendPasswordResetEmail,
} from "@/server/notify/auth";
import { placeholderEmailFor } from "./placeholder-email";
import { otpPolicy, passwordPolicy, passwordResetLinkSeconds } from "./policy";
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
    policyPlugin(),
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
