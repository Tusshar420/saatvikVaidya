import "server-only";
import { brand as copy } from "@/content/brand";
import { roleCanAccess } from "@/lib/admin-permissions";
import { formatPaise } from "@/lib/format";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { db } from "@/server/db";
import { authEnv } from "@/server/env";
import { notifications as inApp } from "@/content/notifications";
import { createNotifications } from "@/server/notifications/notifications";
import { getNotifier } from "./index";
import { recipientSelect, sendToBuyer } from "./orders";

// Build Your Brand messages (P2.1, dev log for now). Text lives in
// src/content/brand.ts. The buyer's order-notification preferences (P1.10)
// apply, as for store orders. In-app notifications (the bell) are always
// saved; admins get theirs only if their role covers orders.

/** Admins whose role covers orders (super and orders admins). */
async function orderAdmins() {
  const admins = await db.user.findMany({
    where: { role: "admin" },
    select: { id: true, email: true, adminRole: true },
  });
  return admins.filter((admin) => roleCanAccess(admin.adminRole, "orders"));
}

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
      userId: true,
      user: { select: recipientSelect },
      brandDetails: { select: { brandName: true } },
      items: {
        orderBy: { id: "asc" },
        select: { productName: true, quantity: true, product: { select: { brandUnitLabel: true } } },
      },
    },
  });
  if (!order || order.type !== "brand") return;
  const products = order.items.map((item) =>
    copy.messages.line(item.productName, copy.myBrand.units(item.quantity, item.product?.brandUnitLabel ?? "")),
  );
  const total = formatPaise(order.totalPaise);
  const base = authEnv().BETTER_AUTH_URL;

  const brandName = order.brandDetails?.brandName ?? "";
  const admins = await orderAdmins();
  await createNotifications([
    ...(order.userId
      ? [
          {
            userId: order.userId,
            kind: "brand" as const,
            title: inApp.messages.brandPaid.title(order.number),
            body: inApp.messages.brandPaid.body(total),
            href: `/my-brand/${order.id}`,
          },
        ]
      : []),
    ...admins.map((admin) => ({
      userId: admin.id,
      kind: "admin" as const,
      title: inApp.messages.adminBrandPaid.title(order.number),
      body: inApp.messages.adminBrandPaid.body(order.user?.name ?? "", brandName, total),
      href: `/admin/brand-orders/${order.id}`,
    })),
  ]);

  if (order.user) {
    const { subject, body, sms } = copy.messages.paid;
    const link = new URL(`/my-brand/${order.id}`, base).toString();
    await sendToBuyer(
      order.user,
      {
        subject: subject(order.number),
        text: body(order.user.name, order.number, products, total, link),
      },
      sms(order.number, total),
    );
  }

  const link = new URL(`/admin/brand-orders/${order.id}`, base).toString();
  const { subject, body } = copy.messages.admin;
  for (const admin of admins) {
    if (isPlaceholderEmail(admin.email)) continue;
    await getNotifier().send({
      channel: "email",
      to: admin.email,
      subject: subject(order.number, brandName),
      text: body(order.number, order.user?.name ?? "", brandName, products, total, link),
    });
  }
}

/** To the customer: a new proof version is ready (P2.2). */
export async function sendProofSent(orderId: string, version: number): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      type: true,
      userId: true,
      user: { select: recipientSelect },
      brandDetails: { select: { proofs: { where: { version }, select: { note: true } } } },
    },
  });
  if (!order?.user || !order.userId || order.type !== "brand") return;
  await createNotifications([
    {
      userId: order.userId,
      kind: "brand",
      title: inApp.messages.proofSent.title(order.number, version),
      body: order.brandDetails?.proofs[0]?.note || inApp.messages.proofSent.body,
      href: `/my-brand/${order.id}`,
    },
  ]);
  const text = copy.messages.proofSent;
  const link = new URL(`/my-brand/${order.id}`, authEnv().BETTER_AUTH_URL).toString();
  await sendToBuyer(
    order.user,
    {
      subject: text.subject(order.number, version),
      text: text.body(order.user.name, order.number, version, order.brandDetails?.proofs[0]?.note ?? null, link),
    },
    text.sms(order.number),
  );
}

/** To the customer: the order moved into production, quality check, dispatch or delivery (P2.2). */
export async function sendStageUpdate(
  orderId: string,
  stage: keyof typeof copy.messages.stage.lines,
): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      type: true,
      userId: true,
      user: { select: recipientSelect },
      shipment: { select: { courierName: true, awb: true } },
    },
  });
  if (!order?.user || !order.userId || order.type !== "brand") return;
  const text = copy.messages.stage;
  const line = text.lines[stage];
  await createNotifications([
    {
      userId: order.userId,
      kind: "brand",
      title: inApp.messages.brandStage.title(order.number, copy.detail.stageLabels[stage]),
      body: line,
      href: `/my-brand/${order.id}`,
    },
  ]);
  const courier =
    order.shipment && (stage === "dispatched" || stage === "delivered")
      ? text.courier(order.shipment.courierName, order.shipment.awb)
      : null;
  const link = new URL(`/my-brand/${order.id}`, authEnv().BETTER_AUTH_URL).toString();
  await sendToBuyer(
    order.user,
    {
      subject: text.subject(order.number, copy.detail.stageLabels[stage]),
      text: text.body(order.user.name, order.number, line, courier, link),
    },
    text.sms(order.number, line),
  );
}

/** To every super or orders admin: the customer approved a proof or asked for changes (P2.2). */
export async function sendProofDecision(
  orderId: string,
  decision: "approve" | "changes",
  version: number,
  comment: string | null,
): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      type: true,
      user: { select: { name: true } },
      brandDetails: { select: { brandName: true } },
    },
  });
  if (!order || order.type !== "brand") return;
  const text = copy.messages.decision;
  const brandName = order.brandDetails?.brandName ?? "";
  const customer = order.user?.name ?? "";
  const link = new URL(`/admin/brand-orders/${order.id}`, authEnv().BETTER_AUTH_URL).toString();
  const approved = decision === "approve";
  const admins = await orderAdmins();
  await createNotifications(
    admins.map((admin) => ({
      userId: admin.id,
      kind: "admin" as const,
      title: approved
        ? inApp.messages.adminProofApproved.title(order.number)
        : inApp.messages.adminProofChanges.title(order.number),
      body: approved
        ? inApp.messages.adminProofApproved.body(customer, version)
        : inApp.messages.adminProofChanges.body(customer, version, comment ?? ""),
      href: `/admin/brand-orders/${order.id}`,
    })),
  );
  for (const admin of admins) {
    if (isPlaceholderEmail(admin.email)) continue;
    await getNotifier().send({
      channel: "email",
      to: admin.email,
      subject: approved
        ? text.subjectApproved(order.number, brandName)
        : text.subjectChanges(order.number, brandName),
      text: approved
        ? text.approved(order.number, customer, brandName, version, link)
        : text.changes(order.number, customer, brandName, version, comment ?? "", link),
    });
  }
}
