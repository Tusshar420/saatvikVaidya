import "server-only";
import { brand as copy } from "@/content/brand";
import { roleCanAccess } from "@/lib/admin-permissions";
import { formatPaise } from "@/lib/format";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { db } from "@/server/db";
import { authEnv } from "@/server/env";
import { getNotifier } from "./index";
import { recipientSelect, sendToBuyer } from "./orders";

// Launch Your Brand messages (P2.1, dev log for now). Text lives in
// src/content/brand.ts. The buyer's order-notification preferences (P1.10)
// apply, as for store orders.

/**
 * A brand order was paid: the buyer is told, and so is every admin who can
 * see orders (super and orders admins), with a link to the admin page.
 */
export async function sendBrandOrderPaid(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      type: true,
      totalPaise: true,
      user: { select: recipientSelect },
      brandDetails: { select: { brandName: true } },
      items: {
        take: 1,
        orderBy: { id: "asc" },
        select: { productName: true, quantity: true, product: { select: { brandUnitLabel: true } } },
      },
    },
  });
  if (!order || order.type !== "brand") return;
  const item = order.items[0];
  const units = item
    ? copy.myBrand.units(item.quantity, item.product?.brandUnitLabel ?? "")
    : "";
  const productName = item?.productName ?? "";
  const total = formatPaise(order.totalPaise);
  const base = authEnv().BETTER_AUTH_URL;

  if (order.user) {
    const { subject, body, sms } = copy.messages.paid;
    const link = new URL(`/my-brand/${order.id}`, base).toString();
    await sendToBuyer(
      order.user,
      {
        subject: subject(order.number),
        text: body(order.user.name, order.number, productName, units, total, link),
      },
      sms(order.number, total),
    );
  }

  const admins = await db.user.findMany({
    where: { role: "admin" },
    select: { email: true, adminRole: true },
  });
  const link = new URL(`/admin/brand-orders/${order.id}`, base).toString();
  const brandName = order.brandDetails?.brandName ?? "";
  const { subject, body } = copy.messages.admin;
  for (const admin of admins) {
    if (!roleCanAccess(admin.adminRole, "orders") || isPlaceholderEmail(admin.email)) continue;
    await getNotifier().send({
      channel: "email",
      to: admin.email,
      subject: subject(order.number, brandName),
      text: body(order.number, order.user?.name ?? "", brandName, productName, units, total, link),
    });
  }
}
