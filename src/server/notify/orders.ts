import "server-only";
import { checkout as copy } from "@/content/checkout";
import { orders as ordersCopy } from "@/content/orders";
import { addressOneLine } from "@/lib/address";
import type { ShipmentStatusKey } from "@/lib/shipping";
import { formatPaise } from "@/lib/format";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { db } from "@/server/db";
import { authEnv } from "@/server/env";
import { getNotifier } from "./index";

// Order messages (dev log for now). Text lives in src/content/checkout.ts.
// Phone-only accounts (placeholder email) get an SMS instead of an email.

/** To the buyer: their order is paid and confirmed. */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true, email: true, phoneNumber: true } },
      items: { orderBy: { id: "asc" } },
    },
  });
  if (!order?.user) return;
  const { user } = order;
  const { subject, body, item, sms } = copy.messages.confirmed;
  const total = formatPaise(order.totalPaise);

  if (!isPlaceholderEmail(user.email)) {
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
  } else if (user.phoneNumber) {
    await getNotifier().send({
      channel: "sms",
      to: user.phoneNumber,
      text: sms(order.number, total),
    });
  }
}

type Recipient = { name: string; email: string; phoneNumber: string | null };

/** Email, or SMS for phone-only accounts. Nothing if there's no way to reach them. */
async function sendToBuyer(
  user: Recipient,
  email: { subject: string; text: string },
  sms: string,
): Promise<void> {
  if (!isPlaceholderEmail(user.email)) {
    await getNotifier().send({ channel: "email", to: user.email, ...email });
  } else if (user.phoneNumber) {
    await getNotifier().send({ channel: "sms", to: user.phoneNumber, text: sms });
  }
}

/** To the buyer: their parcel moved on (P1.5). */
export async function sendShipmentUpdate(orderId: string, status: ShipmentStatusKey): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      number: true,
      user: { select: { name: true, email: true, phoneNumber: true } },
      shipment: { select: { courierName: true, awb: true } },
    },
  });
  if (!order?.user) return;
  const text = ordersCopy.messages.shipment;
  const line = text.lines[status];
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
      number: true,
      paidAt: true,
      user: { select: { name: true, email: true, phoneNumber: true } },
    },
  });
  if (!order?.user) return;
  const text = ordersCopy.messages.cancelled;
  await sendToBuyer(
    order.user,
    {
      subject: text.subject(order.number),
      text: text.body(order.user.name, order.number, order.paidAt !== null),
    },
    text.sms(order.number),
  );
}
