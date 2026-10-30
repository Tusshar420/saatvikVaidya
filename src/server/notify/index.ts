import "server-only";
import nodemailer from "nodemailer";
import { isDevOtpVisible, smtpEnv } from "@/server/env";
import { recordDevOtp, type OtpPurpose } from "./dev-outbox";
import type { InlineImage } from "./email";

/**
 * Outgoing SMS and email go through here. Stage A has no real providers:
 * the dev sender prints messages to the server log. Real providers (MSG91,
 * email) come later and only need to implement `Notifier`.
 */

export type Message =
  | {
      channel: "sms";
      to: string;
      text: string;
      /** Set on OTP messages so the dev sender can show the code in the UI. */
      otp?: { code: string; purpose: OtpPurpose; expiresAt: Date };
    }
  | {
      channel: "email";
      to: string;
      subject: string;
      /** The plain-text version; always set. */
      text: string;
      /** The designed version (src/server/notify/email.ts), when there is one. */
      html?: string;
      /** Images the HTML shows with src="cid:..." (the logo, a QR code). */
      attachments?: InlineImage[];
    };

export interface Notifier {
  send(message: Message): Promise<void>;
}

export const devLogNotifier: Notifier = {
  async send(message) {
    const heading =
      message.channel === "email"
        ? `email to ${message.to}: ${message.subject}`
        : `sms to ${message.to}`;
    console.info(`[notify:dev] ${heading}\n${message.text}`);
    if (message.channel === "sms" && message.otp && isDevOtpVisible()) {
      recordDevOtp({ phoneNumber: message.to, ...message.otp });
    }
  },
};

/**
 * Real email over SMTP, when SMTP_HOST is set. A failed send is logged and
 * not thrown, so a mail problem never breaks sign-up, checkout or an admin
 * action. SMS still goes to the dev log (no SMS provider yet).
 */
type SmtpConfig = NonNullable<ReturnType<typeof smtpEnv>>;

function createTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

/** What nodemailer sends: the text, the HTML if any, and its inline images. */
function mailOptions(config: SmtpConfig, message: Extract<Message, { channel: "email" }>) {
  return {
    from: config.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
    ...(message.attachments?.length
      ? {
          attachments: message.attachments.map((image) => ({
            cid: image.cid,
            filename: image.filename,
            content: image.content,
            contentType: image.contentType,
            contentDisposition: "inline" as const,
          })),
        }
      : {}),
  };
}

function smtpNotifier(config: SmtpConfig): Notifier {
  const transport = createTransport(config);
  return {
    async send(message) {
      if (message.channel !== "email") return devLogNotifier.send(message);
      try {
        await transport.sendMail(mailOptions(config, message));
      } catch (error) {
        console.error(`[notify:smtp] could not send "${message.subject}" to ${message.to}`, error);
      }
    },
  };
}

export type TestEmailResult =
  | { ok: true }
  | { ok: false; reason: "not-configured" }
  | { ok: false; reason: "failed"; detail: string };

/**
 * Sends one email and reports what happened, instead of swallowing the
 * error like the normal sender. For the "Send test email" button, so the
 * team can see why mail isn't arriving. The detail never includes the password.
 */
export async function sendTestEmail(
  to: string,
  email: Pick<Extract<Message, { channel: "email" }>, "subject" | "text" | "html" | "attachments">,
): Promise<TestEmailResult> {
  const config = smtpEnv();
  if (!config) return { ok: false, reason: "not-configured" };
  try {
    await createTransport(config).sendMail(mailOptions(config, { channel: "email", to, ...email }));
    return { ok: true };
  } catch (error) {
    console.error(`[notify:smtp] test email to ${to} failed`, error);
    const code = error instanceof Error && "code" in error ? String((error as { code: unknown }).code) : "";
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: "failed", detail: [code, message].filter(Boolean).join(": ").slice(0, 300) };
  }
}

let smtp: { key: string; notifier: Notifier } | undefined;

export function getNotifier(): Notifier {
  const config = smtpEnv();
  if (!config) return devLogNotifier;
  const key = JSON.stringify(config);
  if (smtp?.key !== key) smtp = { key, notifier: smtpNotifier(config) };
  return smtp.notifier;
}

export type { OtpPurpose } from "./dev-outbox";
