import "server-only";
import { checkout as copy } from "@/content/checkout";
import { orders as ordersCopy } from "@/content/orders";
import { addressOneLine } from "@/lib/address";
import type { ShipmentStatusKey } from "@/lib/shipping";
import { formatPaise } from "@/lib/format";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { db } from "@/server/db";
import { authEnv } from "@/server/env";
import { createNotification } from "@/server/notifications/notifications";
import { notifications as inApp } from "@/content/notifications";
import { getNotifier } from "./index";

// Order messages (dev log for now). Text lives in src/content/checkout.ts.
// Phone-only accounts (placeholder email) get an SMS instead of an email.
// Each buyer's notification preferences (P1.10) decide whether the email or
// the SMS is sent at all. The in-app notification (the header's bell) is
// always saved: it isn't a message sent anywhere.

/** The buyer's page for an order: brand orders have their own. */
export function orderPagePath(order: { id: string; type: string }): string {
  return order.type === "brand" ? `/my-brand/${order.id}` : `/orders/${order.id}`;
}

export const recipientSelect = {
  name: true,
  email: true,
  phoneNumber: true,
  notifyOrderSms: true,
  notifyOrderEmail: true,
} as const;

/** To the buyer: their order is paid and confirmed. */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: recipientSelect },
      items: { orderBy: { id: "asc" } },
    },
  });
  if (!order?.user || !order.userId) return;
  const { user } = order;
  const { subject, body, item, sms } = copy.messages.confirmed;
  const total = formatPaise(order.totalPaise);
  await createNotification({
    userId: order.userId,
    kind: "order",
    title: inApp.messages.orderConfirmed.title(order.number),
    body: inApp.messages.orderConfirmed.body(total),
    href: orderPagePath(order),
  });

  if (!isPlaceholderEmail(user.email)) {
    if (!user.notifyOrderEmail) return;
    await getNotifier().send({
      channel: "email",
      to: user.email,
      subject: subject(order.number),
      text: body(
        user.name,
        order.number,
        total,
        order.items.map((line) =>
          item(line.productName, line.quantity, formatPaise(line.lineTotalPaise)),
        ),
        addressOneLine({
          name: order.shipName,
          phone: order.shipPhone,
          line1: order.shipLine1,
          line2: order.shipLine2,
          landmark: order.shipLandmark,
          city: order.shipCity,
          state: order.shipState,
          pincode: order.shipPincode,
        }),
      ),
    });
  } else if (user.phoneNumber && user.notifyOrderSms) {
    await getNotifier().send({
      channel: "sms",
      to: user.phoneNumber,
      text: sms(order.number, total),
    });
  }
}

type Recipient = {
  name: string;
  email: string;
  phoneNumber: string | null;
  notifyOrderSms: boolean;
  notifyOrderEmail: boolean;
};

/** Email, or SMS for phone-only accounts. Nothing if there's no way to reach them. */
export async function sendToBuyer(
  user: Recipient,
  email: { subject: string; text: string },
  sms: string,
): Promise<void> {
  if (!isPlaceholderEmail(user.email)) {
    if (user.notifyOrderEmail) {
      await getNotifier().send({ channel: "email", to: user.email, ...email });
    }
  } else if (user.phoneNumber && user.notifyOrderSms) {
    await getNotifier().send({ channel: "sms", to: user.phoneNumber, text: sms });
  }
}

/** To the buyer: their parcel moved on (P1.5). */
export async function sendShipmentUpdate(orderId: string, status: ShipmentStatusKey): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      type: true,
      number: true,
      userId: true,
      user: { select: recipientSelect },
      shipment: { select: { courierName: true, awb: true } },
    },
  });
  if (!order?.user || !order.userId) return;
  const text = ordersCopy.messages.shipment;
  const line = text.lines[status];
  await createNotification({
    userId: order.userId,
    kind: order.type === "brand" ? "brand" : "order",
    title: inApp.messages.shipment.title(order.number, ordersCopy.shipmentStatus[status]),
    body: line,
    href: orderPagePath(order),
  });
  const courier =
    order.shipment && status !== "created" && status !== "cancelled"
      ? text.courier(order.shipment.courierName, order.shipment.awb)
      : null;
  const trackUrl = new URL("/track", authEnv().BETTER_AUTH_URL).toString();
  await sendToBuyer(
    order.user,
    {
      subject: text.subject(order.number, ordersCopy.shipmentStatus[status]),
      text: text.body(order.user.name, order.number, line, courier, trackUrl),
    },
    text.sms(order.number, line),
  );
}

/** To the buyer: an admin cancelled their order (P1.5). */
export async function sendOrderCancelled(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      type: true,
      number: true,
      paidAt: true,
      userId: true,
      user: { select: recipientSelect },
    },
  });
  if (!order?.user || !order.userId) return;
  const text = ordersCopy.messages.cancelled;
  await createNotification({
    userId: order.userId,
    kind: order.type === "brand" ? "brand" : "order",
    title: inApp.messages.orderCancelled.title(order.number),
    body: inApp.messages.orderCancelled.body(order.paidAt !== null),
    href: orderPagePath(order),
  });
  await sendToBuyer(
    order.user,
    {
      subject: text.subject(order.number),
      text: text.body(order.user.name, order.number, order.paidAt !== null),
    },
    text.sms(order.number),
  );
}
