import "server-only";

/**
 * Outgoing SMS and email go through here. Stage A has no real providers:
 * the dev sender prints messages to the server log. Chunk A5 adds the OTP and
 * password-reset messages; real providers (MSG91, email) come later.
 */

export type Message =
  | { channel: "sms"; to: string; text: string }
  | { channel: "email"; to: string; subject: string; text: string };

export interface Notifier {
  send(message: Message): Promise<void>;
}

export const devLogNotifier: Notifier = {
  async send(message) {
    console.info(`[notify:dev] ${message.channel} to ${message.to}`, message);
  },
};

export function getNotifier(): Notifier {
  return devLogNotifier;
}
