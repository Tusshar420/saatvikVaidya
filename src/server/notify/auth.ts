import "server-only";
import { authMessages } from "@/content/auth";
import { emailVerificationLinkSeconds, otpPolicy, passwordResetLinkSeconds } from "@/server/auth/policy";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { getNotifier, type OtpPurpose } from "./index";

// The messages the auth system sends. Text lives in src/content/auth.ts.

const otpMinutes = otpPolicy.expiresInSeconds / 60;

export async function sendOtpSms(
  phoneNumber: string,
  code: string,
  purpose: OtpPurpose,
): Promise<void> {
  const text =
    purpose === "sign-in"
      ? authMessages.otpSms(code, otpMinutes)
      : authMessages.passwordResetSms(code, otpMinutes);
  await getNotifier().send({
    channel: "sms",
    to: phoneNumber,
    text,
    otp: {
      code,
      purpose,
      expiresAt: new Date(Date.now() + otpPolicy.expiresInSeconds * 1000),
    },
  });
}

interface Recipient {
  email: string;
  name: string;
}

export async function sendPasswordResetEmail(
  user: Recipient,
  url: string,
): Promise<void> {
  // Phone-only accounts have a placeholder address that can't get mail.
  if (isPlaceholderEmail(user.email)) return;
  const { subject, body } = authMessages.passwordResetEmail;
  await getNotifier().send({
    channel: "email",
    to: user.email,
    subject,
    text: body(user.name, url, passwordResetLinkSeconds / 60),
  });
}

/** Tells an account owner that someone tried to register their email. */
export async function sendExistingAccountEmail(user: Recipient): Promise<void> {
  if (isPlaceholderEmail(user.email)) return;
  const { subject, body } = authMessages.existingAccountEmail;
  await getNotifier().send({
    channel: "email",
    to: user.email,
    subject,
    text: body(user.name),
  });
}

/** The "verify your email" link requested from /account. */
export async function sendVerificationEmail(
  user: Recipient,
  url: string,
): Promise<void> {
  if (isPlaceholderEmail(user.email)) return;
  const { subject, body } = authMessages.verificationEmail;
  await getNotifier().send({
    channel: "email",
    to: user.email,
    subject,
    text: body(user.name, url, emailVerificationLinkSeconds / 60),
  });
}
