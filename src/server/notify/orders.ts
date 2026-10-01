import "server-only";
import { checkout as copy } from "@/content/checkout";
import { addressOneLine } from "@/lib/address";
import { formatPaise } from "@/lib/format";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { db } from "@/server/db";
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
