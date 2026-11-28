import "server-only";
import { authMessages } from "@/content/auth";
import { emailVerificationLinkSeconds, otpPolicy, passwordResetLinkSeconds } from "@/server/auth/policy";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { signInPath } from "@/lib/auth-routes";
import { isDevOtpVisible } from "@/server/env";
import { sendEmail, siteLink } from "./compose";
import { recordDevOtp } from "./dev-outbox";
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

/**
 * The email sign-in code (email OTP). With DEV_SHOW_OTP on (never in
 * production) the code is also kept for the dev banner in the sign-in modal.
 */
export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const text = authMessages.otpEmail;
  if (isDevOtpVisible()) {
    recordDevOtp({
      to: email,
      code,
      purpose: "sign-in",
      expiresAt: new Date(Date.now() + otpPolicy.expiresInSeconds * 1000),
    });
  }
  await sendEmail(email, {
    subject: text.subject(code),
    preheader: text.preheader,
    heading: text.heading,
    footer: "account",
    blocks: [
      { kind: "text", text: text.line },
      { kind: "details", rows: [{ label: text.codeLabel, value: code }] },
      { kind: "text", text: text.expiry(otpMinutes) },
      { kind: "text", text: text.ignore },
    ],
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
  const text = authMessages.passwordResetEmail;
  await sendEmail(user.email, {
    subject: text.subject,
    preheader: text.preheader,
    greetName: user.name,
    heading: text.heading,
    footer: "account",
    blocks: [
      { kind: "text", text: text.line(passwordResetLinkSeconds / 60) },
      { kind: "button", label: text.button, href: url },
      { kind: "text", text: text.ignore },
    ],
  });
}

/** Tells an account owner that someone tried to register their email. */
export async function sendExistingAccountEmail(user: Recipient): Promise<void> {
  if (isPlaceholderEmail(user.email)) return;
  const text = authMessages.existingAccountEmail;
  await sendEmail(user.email, {
    subject: text.subject,
    preheader: text.preheader,
    greetName: user.name,
    heading: text.heading,
    footer: "account",
    blocks: [
      { kind: "text", text: text.line },
      { kind: "text", text: text.next },
      { kind: "button", label: text.button, href: siteLink(signInPath()) },
    ],
  });
}

/** The "verify your email" link requested from /account. */
export async function sendVerificationEmail(
  user: Recipient,
  url: string,
): Promise<void> {
  if (isPlaceholderEmail(user.email)) return;
  const text = authMessages.verificationEmail;
  await sendEmail(user.email, {
    subject: text.subject,
    preheader: text.preheader,
    greetName: user.name,
    heading: text.heading,
    footer: "account",
    blocks: [
      { kind: "text", text: text.line(emailVerificationLinkSeconds / 60) },
      { kind: "button", label: text.button, href: url },
      { kind: "text", text: text.ignore },
    ],
  });
}

/** Welcomes a new account that signed up with an email address. */
export async function sendWelcomeEmail(user: Recipient): Promise<void> {
  if (isPlaceholderEmail(user.email)) return;
  const text = authMessages.welcomeEmail;
  await sendEmail(user.email, {
    subject: text.subject,
    preheader: text.preheader,
    greetName: user.name,
    heading: text.heading,
    footer: "account",
    blocks: [
      { kind: "text", text: text.line },
      { kind: "items", rows: text.perks.map((perk) => ({ name: perk })) },
      { kind: "button", label: text.button, href: siteLink("/products") },
      { kind: "note", text: text.professional },
    ],
  });
}
