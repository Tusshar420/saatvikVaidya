import "server-only";
import { brand as copy } from "@/content/brand";
import { emails } from "@/content/emails";
import { formatPaise } from "@/lib/format";
import { db } from "@/server/db";
import { notifications as inApp } from "@/content/notifications";
import { createNotifications } from "@/server/notifications/notifications";
import { siteLink } from "./compose";
import type { EmailBlock } from "./email";
import {
  detailsBlock,
  emailOrderAdmins,
  itemsBlock,
  orderAdmins,
  readEmailOrder,
  recipientSelect,
  sendToBuyer,
} from "./orders";

// Build Your Brand messages (P2.1, P2.2): payment received, label proof
// ready, production, dispatch and delivery, each with the brand tracker and
// a button to the order. Text lives in src/content/brand.ts. The buyer's
// order-notification preferences (P1.10) apply, as for store orders.
// In-app notifications (the bell) are always saved; admins get theirs only
// if their role covers orders.

/** Where each stage sits on the brand tracker (src/content/emails.ts). */
const trackerStep = {
  in_production: 3,
  quality_check: 3,
  dispatched: 4,
  delivered: 5,
} as const;

const steps = (current: number): EmailBlock => ({ kind: "steps", steps: emails.steps.brand, current });

/**
 * A brand order was paid: the buyer is told, and so is every admin who can
 * see orders (super and orders admins), with a link to the admin page.
 */
export async function sendBrandOrderPaid(orderId: string): Promise<void> {
  const order = await readEmailOrder(orderId);
  if (!order || order.type !== "brand") return;
  const total = formatPaise(order.totalPaise);
  const brandName = order.brandDetails?.brandName ?? "";
  const customer = order.user?.name ?? "";
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
      body: inApp.messages.adminBrandPaid.body(customer, brandName, total),
      href: `/admin/brand-orders/${order.id}`,
    })),
  ]);

  if (order.user) {
    const text = copy.messages.paid;
    await sendToBuyer(
      order.user,
      {
        subject: text.subject(order.number),
        preheader: text.preheader,
        greetName: order.user.name,
        heading: text.heading,
        footer: "order",
        blocks: [
          steps(2),
          { kind: "text", text: text.line(order.number) },
          { kind: "note", text: text.next },
          itemsBlock(order),
          detailsBlock(order),
          { kind: "button", label: emails.order.viewOrder, href: siteLink(`/my-brand/${order.id}`) },
        ],
      },
      text.sms(order.number, total),
    );
  }

  const text = copy.messages.admin;
  await emailOrderAdmins({
    subject: text.subject(order.number, brandName, total),
    preheader: text.line(customer, brandName, total),
    heading: text.heading(order.number),
    footer: "staff",
    blocks: [
      { kind: "text", text: text.line(customer, brandName, total) },
      { kind: "button", label: text.button, href: siteLink(`/admin/brand-orders/${order.id}`) },
      itemsBlock(order),
      detailsBlock(order),
    ],
  });
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
  const note = order.brandDetails?.proofs[0]?.note || null;
  await createNotifications([
    {
      userId: order.userId,
      kind: "brand",
      title: inApp.messages.proofSent.title(order.number, version),
      body: note || inApp.messages.proofSent.body,
      href: `/my-brand/${order.id}`,
    },
  ]);
  const text = copy.messages.proofSent;
  await sendToBuyer(
    order.user,
    {
      subject: text.subject(order.number, version),
      preheader: text.preheader,
      greetName: order.user.name,
      heading: text.heading,
      footer: "order",
      blocks: [
        steps(2),
        { kind: "text", text: text.line(order.number, version) },
        ...(note ? [{ kind: "note" as const, title: text.noteTitle, text: note }] : []),
        { kind: "text", text: text.ask },
        { kind: "button", label: text.button, href: siteLink(`/my-brand/${order.id}`) },
      ],
    },
    text.sms(order.number),
  );
}

/** To the customer: the order moved into production, quality check, dispatch or delivery (P2.2). */
export async function sendStageUpdate(
  orderId: string,
  stage: keyof typeof copy.messages.stage.lines,
): Promise<void> {
  const order = await readEmailOrder(orderId);
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
      ? [
          { label: emails.order.courier, value: order.shipment.courierName },
          { label: emails.order.tracking, value: order.shipment.awb },
        ]
      : [];
  await sendToBuyer(
    order.user,
    {
      subject: text.subject(order.number, copy.detail.stageLabels[stage]),
      preheader: line,
      greetName: order.user.name,
      heading: text.headings[stage],
      footer: "order",
      blocks: [
        steps(trackerStep[stage]),
        { kind: "text", text: line },
        ...(courier.length
          ? [{ kind: "details" as const, rows: [{ label: emails.order.number, value: order.number }, ...courier] }]
          : []),
        { kind: "button", label: text.button, href: siteLink(`/my-brand/${order.id}`) },
        itemsBlock(order, false),
      ],
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
  const line = approved
    ? text.approved(order.number, customer, brandName, version)
    : text.changes(order.number, customer, brandName, version);
  await emailOrderAdmins({
    subject: approved ? text.subjectApproved(order.number, brandName) : text.subjectChanges(order.number, brandName),
    preheader: line,
    heading: approved ? text.headingApproved : text.headingChanges,
    footer: "staff",
    blocks: [
      { kind: "text", text: line },
      ...(!approved && comment ? [{ kind: "note" as const, title: text.comment, text: comment, tone: "warning" as const }] : []),
      {
        kind: "button",
        label: approved ? text.buttonApproved : text.buttonChanges,
        href: siteLink(`/admin/brand-orders/${order.id}`),
      },
    ],
  });
}
