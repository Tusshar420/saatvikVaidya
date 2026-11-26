import "server-only";
import { assistedOrders as copy } from "@/content/assisted-orders";
import { emails } from "@/content/emails";
import { preparedOrderPath } from "@/lib/assisted-orders";
import { formatDateTime } from "@/lib/format";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { createNotification } from "@/server/notifications/notifications";
import { getNotifier, smsDelivered } from "./index";
import { sendEmail, siteLink } from "./compose";

// Messages about orders our staff prepare for customers
// (src/server/assisted-orders): the link to review and place the order, and
// the code a customer reads back on a call. Both go by SMS when the customer
// has a mobile number and by email when they have a real address. These are
// messages the customer asked for, so the order-update preferences don't
// apply. Until an SMS provider is connected (smsDelivered()), SMS only reach
// the server log, so they are sent but not counted as reaching the customer.
// Text lives in src/content/assisted-orders.ts.

export type Customer = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
};

/** Which channels a message went out on. */
export type Sent = { sms: boolean; email: boolean };

const realEmail = (customer: Customer) => (isPlaceholderEmail(customer.email) ? null : customer.email);

/** Can a message reach this customer at all? */
export function canReach(customer: Customer): boolean {
  return Boolean((smsDelivered() && customer.phoneNumber) || realEmail(customer));
}

/**
 * The link to a prepared order: SMS, email and a bell notification on the
 * customer's account (always saved, even with nowhere to send a message).
 */
export async function sendPreparedOrderLink(
  customer: Customer,
  order: {
    id: string;
    note: string | null;
    expiresAt: Date;
    items: { name: string; detail: string }[];
  },
): Promise<Sent> {
  const text = copy.notify.link;
  const path = preparedOrderPath(order.id);
  const link = siteLink(path);
  await createNotification({
    userId: customer.id,
    kind: "order",
    title: text.bell.title,
    body: text.bell.body(order.items.length),
    href: path,
  });
  const sent: Sent = { sms: false, email: false };
  if (customer.phoneNumber) {
    await getNotifier().send({ channel: "sms", to: customer.phoneNumber, text: text.sms(customer.name, link) });
    sent.sms = smsDelivered();
  }
  const email = realEmail(customer);
  if (email) {
    await sendEmail(email, {
      subject: text.email.subject,
      preheader: text.email.preheader,
      greetName: customer.name,
      heading: text.email.heading,
      footer: "account",
      blocks: [
        { kind: "text", text: text.email.line },
        ...(order.note
          ? [{ kind: "note" as const, title: text.email.noteTitle, text: order.note, tone: "brand" as const }]
          : []),
        {
          kind: "items",
          title: text.email.itemsTitle,
          rows: order.items.map((item) => ({ name: item.name, detail: item.detail })),
          footnote: emails.order.gst,
        },
        { kind: "button", label: text.email.button, href: link },
        { kind: "text", text: text.email.expires(formatDateTime(order.expiresAt)) },
      ],
    });
    sent.email = true;
  }
  return sent;
}

/** The confirmation code for a prepared order, read back to staff on a call. */
export async function sendPreparedOrderCode(
  customer: Customer,
  code: string,
  total: string,
  expiresAt: Date,
  minutes: number,
): Promise<Sent> {
  const text = copy.notify.code;
  const sent: Sent = { sms: false, email: false };
  if (customer.phoneNumber) {
    await getNotifier().send({
      channel: "sms",
      to: customer.phoneNumber,
      text: text.sms(code, total, minutes),
      otp: { code, purpose: "order-confirm", expiresAt },
    });
    sent.sms = smsDelivered();
  }
  const email = realEmail(customer);
  if (email) {
    await sendEmail(email, {
      subject: text.email.subject(code),
      greetName: customer.name,
      heading: text.email.heading,
      footer: "account",
      blocks: [
        { kind: "text", text: text.email.line(total) },
        { kind: "note", text: code, tone: "brand" },
        { kind: "text", text: text.email.expires(minutes) },
        { kind: "note", text: text.email.warning, tone: "warning" },
      ],
    });
    sent.email = true;
  }
  return sent;
}
