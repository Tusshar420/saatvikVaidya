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
    preheader: "Use the button inside to choose a new password.",
    heading: "Reset your password",
    line: (minutes: number) =>
      `We got a request to reset your password. Tap the button below to choose a new one. The link works once and expires in ${minutes} minutes.`,
    button: "Choose a new password",
    ignore: "If you didn't ask to reset your password, you can ignore this email. Your password stays the same.",
  },
  verificationEmail: {
    subject: "Verify your Saatvik Vaidya email",
    preheader: "One tap to confirm your email address.",
    heading: "Confirm your email address",
    line: (minutes: number) => `Tap the button below to confirm this is your email address. The link expires in ${minutes} minutes.`,
    button: "Confirm my email",
    ignore: "If you didn't ask for this, you can ignore this email.",
  },
  existingAccountEmail: {
    subject: "Someone tried to register with your email",
    preheader: "You already have an account, so nothing was changed.",
    heading: "You already have an account",
    line: "Someone just tried to create a Saatvik Vaidya account with this email address. You already have an account, so nothing was changed.",
    next: "If this was you, sign in instead, or reset your password if you've forgotten it.",
    button: "Sign in",
  },
  welcomeEmail: {
    subject: "Welcome to Saatvik Vaidya",
    preheader: "Your account is ready. Authentic Ayurveda, delivered to your door.",
    heading: "Welcome! Your account is ready.",
    line: "Thank you for joining Saatvik Vaidya. Here's what you can do with your account:",
    perks: [
      "Shop authentic Ayurvedic medicines from trusted brands.",
      "Earn Super Coins on every order and use them on the next one.",
      "Follow every order from packing to your doorstep.",
      "Learn from expert doctors with our courses and ebooks.",
    ],
    professional:
      "Are you a doctor or a professional? Upload your documents from My account to unlock professional prices.",
    button: "Start shopping",
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
