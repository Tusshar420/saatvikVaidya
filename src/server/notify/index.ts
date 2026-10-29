import "server-only";
import nodemailer from "nodemailer";
import { isDevOtpVisible, smtpEnv } from "@/server/env";
import { recordDevOtp, type OtpPurpose } from "./dev-outbox";

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
  | { channel: "email"; to: string; subject: string; text: string };

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
function smtpNotifier(config: NonNullable<ReturnType<typeof smtpEnv>>): Notifier {
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  });
  return {
    async send(message) {
      if (message.channel !== "email") return devLogNotifier.send(message);
      try {
        await transport.sendMail({
          from: config.EMAIL_FROM,
          to: message.to,
          subject: message.subject,
          text: message.text,
        });
      } catch (error) {
        console.error(`[notify:smtp] could not send "${message.subject}" to ${message.to}`, error);
      }
    },
  };
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
