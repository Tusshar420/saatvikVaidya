// Sign-in and account messages: SMS/email text sent by the server and the
// error messages auth endpoints return. Keep user-facing text here so Hindi
// can be added later.

export const authMessages = {
  otpSms: (code: string, minutes: number) =>
    `${code} is your Saatvik Vaidya sign-in code. It expires in ${minutes} minutes. Never share it with anyone.`,
  passwordResetSms: (code: string, minutes: number) =>
    `${code} is your Saatvik Vaidya password reset code. It expires in ${minutes} minutes. If you didn't ask for it, you can ignore this message.`,
  passwordResetEmail: {
    subject: "Reset your Saatvik Vaidya password",
    body: (name: string, url: string, minutes: number) =>
      `Namaste ${name},\n\nUse this link to choose a new password. It works once and expires in ${minutes} minutes:\n\n${url}\n\nIf you didn't ask to reset your password, you can ignore this email.`,
  },
  verificationEmail: {
    subject: "Verify your Saatvik Vaidya email",
    body: (name: string, url: string, minutes: number) =>
      `Namaste ${name},\n\nUse this link to confirm your email address. It expires in ${minutes} minutes:\n\n${url}\n\nIf you didn't ask for this, you can ignore this email.`,
  },
  existingAccountEmail: {
    subject: "Someone tried to register with your email",
    body: (name: string) =>
      `Namaste ${name},\n\nSomeone just tried to create a Saatvik Vaidya account with this email address. You already have an account, so nothing was changed.\n\nIf this was you, sign in instead, or reset your password if you've forgotten it.`,
  },
} as const;

/**
 * Error messages by code. Codes come from Better Auth or from our policy
 * plugin (src/server/auth/policy-plugin.ts). None of them say whether an
 * account exists.
 */
export const authErrors = {
  INVALID_INPUT: "Please check the highlighted details and try again.",
  INVALID_PHONE_NUMBER: "Enter a valid 10-digit Indian mobile number.",
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_OTP: "That code isn't right. Check the SMS and try again.",
  OTP_EXPIRED: "That code has expired. Ask for a new one.",
  OTP_NOT_FOUND: "That code has expired. Ask for a new one.",
  TOO_MANY_ATTEMPTS: "Too many wrong codes. Ask for a new one.",
  RATE_LIMITED:
    "Too many attempts. Please wait a few minutes before trying again.",
  PASSWORD_TOO_SHORT: "Use at least 8 characters for your password.",
  PASSWORD_TOO_LONG: "Use at most 128 characters for your password.",
  PASSWORD_TOO_COMMON:
    "That password is too common and easy to guess. Choose another one.",
  INVALID_USER_TYPE: "Choose who you are from the list.",
  TERMS_NOT_ACCEPTED: "Please accept the terms to continue.",
  INVALID_EMAIL_OR_PASSWORD:
    "That email and password don't match. Try again or reset your password.",
  INVALID_PHONE_NUMBER_OR_PASSWORD:
    "That number and password don't match. Try again or sign in with a code.",
  INVALID_TOKEN: "This reset link has expired or was already used.",
  TWO_FACTOR_INVALID:
    "That code isn't right. Check your authenticator app and try again.",
  TWO_FACTOR_EXPIRED: "That sign-in took too long. Please sign in again.",
  REGISTRATION_REQUIRED: "Tell us a little about yourself to finish.",
} as const;

export type AuthErrorCode = keyof typeof authErrors;
