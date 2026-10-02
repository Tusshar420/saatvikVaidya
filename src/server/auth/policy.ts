// Auth policy numbers from docs/PLAN.md and docs/CHUNKS.md (A5), in one
// place. No "server-only" here: `pnpm admin:create` uses these too.

export const otpPolicy = {
  length: 6,
  expiresInSeconds: 5 * 60,
  /** Wrong codes allowed per OTP before it is thrown away. */
  allowedAttempts: 5,
} as const;

export const passwordPolicy = {
  minLength: 8,
  maxLength: 128,
  /** The admin account needs a longer password. */
  adminMinLength: 12,
} as const;

/** How long an email-verification link works. */
export const emailVerificationLinkSeconds = 60 * 60;

/** How long an email password-reset link works. */
export const passwordResetLinkSeconds = 60 * 60;

export interface RateLimitRule {
  /** Prefix of the counter key, e.g. "otp-send:phone". */
  name: string;
  windowSeconds: number;
  max: number;
}

export const rateLimitRules = {
  /** OTP (and reset) messages to one phone number: 3 per 10 minutes. */
  otpSendPerPhone: { name: "otp-send:phone", windowSeconds: 10 * 60, max: 3 },
  /** Reset emails to one address: 3 per 10 minutes, like phones. */
  emailSendPerAddress: {
    name: "email-send:address",
    windowSeconds: 10 * 60,
    max: 3,
  },
  /** SMS and email sends from one IP: 10 per hour. */
  messageSendPerIp: { name: "send:ip", windowSeconds: 60 * 60, max: 10 },
  /**
   * Sign-in and other credential checks (sign-up, OTP verify, password
   * reset) from one IP: 10 per 15 minutes.
   */
  signInPerIp: { name: "sign-in:ip", windowSeconds: 15 * 60, max: 10 },
  /** Professional document uploads by one account: 20 per hour. */
  documentUploadPerUser: {
    name: "document-upload:user",
    windowSeconds: 60 * 60,
    max: 20,
  },
  /** New guest carts (each sets a cookie and a database row) from one IP: 30 per hour. */
  guestCartPerIp: { name: "guest-cart:ip", windowSeconds: 60 * 60, max: 30 },
  /** Orders placed by one account: 20 per hour. */
  orderPlacePerUser: { name: "order-place:user", windowSeconds: 60 * 60, max: 20 },
  /** Track Order lookups from one IP: 10 per 15 minutes. */
  trackOrderPerIp: { name: "track-order:ip", windowSeconds: 15 * 60, max: 10 },
  /**
   * Lookups of one order number, from anywhere: 10 per hour, so nobody can
   * guess the phone or email for a known number.
   */
  trackOrderPerNumber: { name: "track-order:number", windowSeconds: 60 * 60, max: 10 },
  /** Wrong-password guesses on "change password": 5 per 15 minutes per account. */
  passwordChangePerUser: { name: "password-change:user", windowSeconds: 15 * 60, max: 5 },
  /** Ebook downloads by one account: 20 per hour. */
  ebookDownloadPerUser: { name: "ebook-download:user", windowSeconds: 60 * 60, max: 20 },
} as const satisfies Record<string, RateLimitRule>;
