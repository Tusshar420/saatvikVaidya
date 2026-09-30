import "server-only";
import { isDevOtpVisible } from "@/server/env";
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

export function getNotifier(): Notifier {
  return devLogNotifier;
}

export type { OtpPurpose } from "./dev-outbox";
