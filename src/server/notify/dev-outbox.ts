import "server-only";

// Dev only: the latest OTP sent to each phone, so the sign-in UI can show it
// (GET /api/dev/otp). Filled only when isDevOtpVisible() is true, which is
// never in production. Kept on globalThis so every route in the dev server
// shares one copy. Memory only; nothing is stored.

export type OtpPurpose = "sign-in" | "password-reset" | "order-confirm";

export interface DevOtp {
  phoneNumber: string;
  code: string;
  purpose: OtpPurpose;
  expiresAt: Date;
}

const MAX_ENTRIES = 100;

const store = globalThis as unknown as { devOtpOutbox?: Map<string, DevOtp> };

function outbox(): Map<string, DevOtp> {
  store.devOtpOutbox ??= new Map();
  return store.devOtpOutbox;
}

export function recordDevOtp(otp: DevOtp): void {
  const entries = outbox();
  entries.delete(otp.phoneNumber);
  entries.set(otp.phoneNumber, otp);
  // Keep the newest entries only (a Map iterates oldest first).
  for (const phone of entries.keys()) {
    if (entries.size <= MAX_ENTRIES) break;
    entries.delete(phone);
  }
}

/** The latest unexpired OTP sent to `phoneNumber`, if any. */
export function latestDevOtp(
  phoneNumber: string,
  now: Date = new Date(),
): DevOtp | null {
  const otp = outbox().get(phoneNumber);
  return otp && otp.expiresAt > now ? otp : null;
}

export function clearDevOtps(): void {
  outbox().clear();
}
