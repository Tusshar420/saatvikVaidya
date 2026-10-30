import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { checkout as copy } from "@/content/checkout";
import { emails } from "@/content/emails";
import { orders as ordersCopy } from "@/content/orders";
import { roleCanAccess } from "@/lib/admin-permissions";
import { addressLines } from "@/lib/address";
import type { ShipmentStatusKey } from "@/lib/shipping";
import { formatDateTime, formatPaise } from "@/lib/format";
import { formatIndianPhone } from "@/lib/phone";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { db } from "@/server/db";
import { createNotification } from "@/server/notifications/notifications";
import { notifications as inApp } from "@/content/notifications";
import { getPaymentProvider, type PaymentProviderName } from "@/server/payments";
import { getNotifier } from "./index";
import { sendEmail, siteLink } from "./compose";
import type { EmailBlock, EmailContent, EmailRow } from "./email";
import { paymentBlocks, paymentMethodLabel } from "./payment-details";

// Order messages, like a big shop sends them: "order received" (with how to
// pay), "payment received, order confirmed", shipped, out for delivery,
// delivered and cancelled, each with the order summary and a button to the
// order page. The team hears about every new order. Text lives in
// src/content/checkout.ts, src/content/orders.ts and src/content/emails.ts.
//
// Phone-only accounts (placeholder email) get an SMS instead of an email.
// Each buyer's notification preferences (P1.10) decide whether the email or
// the SMS is sent at all. The in-app notification (the header's bell) is
// always saved: it isn't a message sent anywhere.

const text = emails.order;

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

type Recipient = {
  name: string;
  email: string;
  phoneNumber: string | null;
  notifyOrderSms: boolean;
  notifyOrderEmail: boolean;
};

/** Email, or SMS for phone-only accounts. Nothing if there's no way to reach them. */
export async function sendToBuyer(user: Recipient, email: EmailContent, sms: string): Promise<void> {
  if (!isPlaceholderEmail(user.email)) {
    if (user.notifyOrderEmail) await sendEmail(user.email, email);
  } else if (user.phoneNumber && user.notifyOrderSms) {
    await getNotifier().send({ channel: "sms", to: user.phoneNumber, text: sms });
  }
}

/** Admins whose role covers orders (super and orders admins). */
export async function orderAdmins() {
  const admins = await db.user.findMany({
    where: { role: "admin" },
    select: { id: true, email: true, adminRole: true },
  });
  return admins.filter((admin) => roleCanAccess(admin.adminRole, "orders"));
}

/** Emails every orders admin who has a real address. */
export async function emailOrderAdmins(email: EmailContent): Promise<void> {
  for (const admin of await orderAdmins()) {
    if (isPlaceholderEmail(admin.email)) continue;
    await sendEmail(admin.email, email);
  }
}

// ─── The order summary ──────────────────────────────────────────────────────

/** Everything an order email shows about the order. */
export const emailOrderSelect = {
  id: true,
  number: true,
  type: true,
  status: true,
  createdAt: true,
  paidAt: true,
  userId: true,
  subtotalPaise: true,
  shippingPaise: true,
  coinDiscountPaise: true,
  coinsRedeemed: true,
  totalPaise: true,
  shipName: true,
  shipPhone: true,
  shipLine1: true,
  shipLine2: true,
  shipLandmark: true,
  shipCity: true,
  shipState: true,
  shipPincode: true,
  user: { select: recipientSelect },
  items: {
    orderBy: { id: "asc" },
    select: {
      kind: true,
      productName: true,
      packSize: true,
      quantity: true,
      lineTotalPaise: true,
      product: { select: { brandUnitLabel: true } },
    },
  },
  shipment: { select: { courierName: true, awb: true } },
  brandDetails: { select: { brandName: true } },
  payments: { orderBy: { attempt: "desc" }, take: 1, select: { provider: true } },
} satisfies Prisma.OrderSelect;

export type EmailOrder = Prisma.OrderGetPayload<{ select: typeof emailOrderSelect }>;

export function readEmailOrder(orderId: string): Promise<EmailOrder | null> {
  return db.order.findUnique({ where: { id: orderId }, select: emailOrderSelect });
}

/** How this order is (or was) paid: the provider on its latest attempt. */
export function orderPaymentProvider(order: EmailOrder): PaymentProviderName {
  const name = order.payments[0]?.provider;
  return name === "manual" || name === "request" || name === "test" ? name : getPaymentProvider().name;
}

function itemDetail(item: EmailOrder["items"][number], brand: boolean): string {
  if (brand) return text.units(item.quantity, item.product?.brandUnitLabel || null);
  return [item.packSize, text.quantity(item.quantity)].filter(Boolean).join(" · ");
}

/** The items, with the totals unless `withTotals` is false. */
export function itemsBlock(order: EmailOrder, withTotals = true): EmailBlock {
  const brand = order.type === "brand";
  const totals = withTotals
    ? [
        { label: text.subtotal, value: formatPaise(order.subtotalPaise) },
        ...(order.coinDiscountPaise > 0
          ? [{ label: text.coins(order.coinsRedeemed), value: `−${formatPaise(order.coinDiscountPaise)}` }]
          : []),
        ...(brand ? [] : [{ label: text.delivery, value: order.shippingPaise > 0 ? formatPaise(order.shippingPaise) : text.free }]),
        {
          label: order.paidAt ? text.totalPaid : text.total,
          value: formatPaise(order.totalPaise),
          strong: true,
        },
      ]
    : undefined;
  return {
    kind: "items",
    title: text.summary,
    rows: order.items.map((item) => ({
      name: item.productName,
      detail: itemDetail(item, brand),
      amount: formatPaise(item.lineTotalPaise),
    })),
    totals,
    footnote: withTotals ? text.gst : undefined,
  };
}

function hasDelivery(order: EmailOrder): boolean {
  return order.items.some((item) => item.kind === "product");
}

/** Order number, date, payment and (when there's something to deliver) the address. */
export function detailsBlock(order: EmailOrder, extra: EmailRow[] = []): EmailBlock {
  const rows: EmailRow[] = [
    { label: text.number, value: order.number },
    { label: text.placedOn, value: formatDateTime(order.createdAt) },
    ...(order.brandDetails?.brandName ? [{ label: text.brand, value: order.brandDetails.brandName }] : []),
    { label: text.payment, value: paymentMethodLabel(orderPaymentProvider(order)) },
    ...extra,
  ];
  if (hasDelivery(order)) {
    rows.push({
      label: text.deliverTo,
      value: [
        order.shipName,
        ...addressLines({
          name: order.shipName,
          phone: order.shipPhone,
          line1: order.shipLine1,
          line2: order.shipLine2,
          landmark: order.shipLandmark,
          city: order.shipCity,
          state: order.shipState,
          pincode: order.shipPincode,
        }),
        formatIndianPhone(order.shipPhone),
      ].join("\n"),
    });
  }
  return { kind: "details", title: text.details, rows };
}

function courierRows(order: EmailOrder): EmailRow[] {
  return order.shipment
    ? [
        { label: text.courier, value: order.shipment.courierName },
        { label: text.tracking, value: order.shipment.awb },
      ]
    : [];
}

// ─── Store orders ───────────────────────────────────────────────────────────

/**
 * To the buyer, when an order (store or brand) is placed and waits for a
 * payment made outside the site (QR code, bank transfer or a phone call),
 * with how to pay. Not sent with test payments: those finish on the spot and
 * send the confirmation instead.
 */
export async function sendOrderPlaced(orderId: string): Promise<void> {
  const order = await readEmailOrder(orderId);
  if (!order?.user || order.status !== "pending_payment") return;
  const provider = orderPaymentProvider(order);
  if (provider === "test") return;
  const message = copy.messages.placed;
  const total = formatPaise(order.totalPaise);
  const brand = order.type === "brand";
  await sendToBuyer(
    order.user,
    {
      subject: message.subject(order.number),
      preheader: provider === "manual" ? message.preheaderManual(total) : message.preheaderRequest,
      greetName: order.user.name,
      heading: message.heading,
      footer: "order",
      blocks: [
        { kind: "steps", steps: brand ? emails.steps.brand : emails.steps.store, current: 0 },
        { kind: "text", text: message.line(order.number) },
        ...(brand ? [{ kind: "text" as const, text: message.brandNext }] : []),
        ...(await paymentBlocks(order, provider)),
        itemsBlock(order),
        detailsBlock(order),
        { kind: "button", label: text.viewOrder, href: siteLink(orderPagePath(order)) },
      ],
    },
    message.sms(order.number, total),
  );
}

/**
 * To the team: a new order (store or brand) waiting for a payment made
 * outside the site, with what to do next. Not sent for test payments.
 */
export async function sendNewOrderToStaff(orderId: string): Promise<void> {
  const order = await readEmailOrder(orderId);
  if (!order) return;
  const provider = orderPaymentProvider(order);
  if (provider === "test") return;
  const message = copy.messages.staff;
  const total = formatPaise(order.totalPaise);
  const customer = order.user?.name || order.shipName;
  const brandName = order.brandDetails?.brandName ?? "";
  const contact: EmailRow[] = [
    { label: text.customer, value: customer },
    { label: text.phone, value: formatIndianPhone(order.user?.phoneNumber ?? order.shipPhone) },
    ...(order.user && !isPlaceholderEmail(order.user.email) ? [{ label: text.email, value: order.user.email }] : []),
  ];
  const adminPath = order.type === "brand" ? `/admin/brand-orders/${order.id}` : `/admin/orders/${order.id}`;
  await emailOrderAdmins({
    subject:
      order.type === "brand"
        ? message.brandSubject(order.number, brandName, total)
        : message.subject(order.number, total, customer),
    preheader: message.line(customer, total),
    heading: order.type === "brand" ? message.brandHeading(order.number) : message.heading(order.number),
    footer: "staff",
    blocks: [
      { kind: "text", text: message.line(customer, total) },
      { kind: "note", text: message[provider] },
      { kind: "button", label: text.openAdmin, href: siteLink(adminPath) },
      itemsBlock(order),
      detailsBlock(order, contact),
    ],
  });
}

/** After an order is placed: the buyer's "order received" and the team's alert. Never throws. */
export async function notifyOrderPlaced(orderId: string): Promise<void> {
  for (const send of [sendOrderPlaced, sendNewOrderToStaff]) {
    try {
      await send(orderId);
    } catch (error) {
      console.error("notifyOrderPlaced: message not sent.", error);
    }
  }
}

/** To the buyer: their order is paid and confirmed. */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const order = await readEmailOrder(orderId);
  if (!order?.user || !order.userId) return;
  const message = copy.messages.confirmed;
  const total = formatPaise(order.totalPaise);
  await createNotification({
    userId: order.userId,
    kind: "order",
    title: inApp.messages.orderConfirmed.title(order.number),
    body: inApp.messages.orderConfirmed.body(total),
    href: orderPagePath(order),
  });
  const digital = order.items.some((item) => item.kind !== "product");
  await sendToBuyer(
    order.user,
    {
      subject: message.subject(order.number),
      preheader: message.preheader,
      greetName: order.user.name,
      heading: message.heading,
      footer: "order",
      blocks: [
        { kind: "steps", steps: emails.steps.store, current: 1 },
        { kind: "text", text: message.line(order.number) },
        ...(digital ? [{ kind: "note" as const, text: message.digital }] : []),
        itemsBlock(order),
        detailsBlock(order),
        { kind: "button", label: text.viewOrder, href: siteLink(orderPagePath(order)) },
      ],
    },
    message.sms(order.number, total),
  );
}

/** Where each delivery step sits on the tracker, and whether it's a problem. */
const trackerStep: Record<ShipmentStatusKey, { current: number; problem?: boolean } | null> = {
  created: { current: 1 },
  packed: { current: 1 },
  shipped: { current: 2 },
  in_transit: { current: 2 },
  out_for_delivery: { current: 3 },
  delivered: { current: 4 },
  undelivered: { current: 3, problem: true },
  returned: { current: 3, problem: true },
  cancelled: null,
};

/** To the buyer: their parcel moved on (P1.5). Small steps only show in the bell. */
export async function sendShipmentUpdate(orderId: string, status: ShipmentStatusKey): Promise<void> {
  const order = await readEmailOrder(orderId);
  if (!order?.user || !order.userId) return;
  const message = ordersCopy.messages.shipment;
  const line = message.lines[status];
  await createNotification({
    userId: order.userId,
    kind: order.type === "brand" ? "brand" : "order",
    title: inApp.messages.shipment.title(order.number, ordersCopy.shipmentStatus[status]),
    body: line,
    href: orderPagePath(order),
  });
  if (!(message.emailSteps as readonly ShipmentStatusKey[]).includes(status)) return;
  // Brand orders have their own steps (sendStageUpdate), so no store tracker here.
  const step = order.type === "brand" ? null : trackerStep[status];
  const problem = status === "undelivered" || status === "returned" || status === "cancelled";
  const showCourier = order.shipment && status !== "created" && status !== "cancelled";
  await sendToBuyer(
    order.user,
    {
      subject: message.subjects[status](order.number),
      preheader: line,
      greetName: order.user.name,
      heading: message.headings[status],
      footer: "order",
      blocks: [
        ...(step ? [{ kind: "steps" as const, steps: emails.steps.store, ...step }] : []),
        problem
          ? { kind: "note", text: message.details[status](order.number), tone: "warning" }
          : { kind: "text", text: message.details[status](order.number) },
        ...(showCourier ? [{ kind: "details" as const, rows: [{ label: text.number, value: order.number }, ...courierRows(order)] }] : []),
        {
          kind: "button",
          label: status === "delivered" ? text.viewOrder : text.trackOrder,
          href: siteLink(orderPagePath(order)),
        },
        itemsBlock(order, false),
      ],
    },
    message.sms(order.number, line),
  );
}

/** To the buyer: an admin cancelled their order (P1.5). */
export async function sendOrderCancelled(orderId: string): Promise<void> {
  const order = await readEmailOrder(orderId);
  if (!order?.user || !order.userId) return;
  const message = ordersCopy.messages.cancelled;
  const paid = order.paidAt !== null;
  await createNotification({
    userId: order.userId,
    kind: order.type === "brand" ? "brand" : "order",
    title: inApp.messages.orderCancelled.title(order.number),
    body: inApp.messages.orderCancelled.body(paid),
    href: orderPagePath(order),
  });
  await sendToBuyer(
    order.user,
    {
      subject: message.subject(order.number),
      preheader: message.preheader(paid),
      greetName: order.user.name,
      heading: message.heading,
      footer: "order",
      blocks: [
        { kind: "text", text: message.line(order.number) },
        { kind: "note", text: paid ? message.paid : message.unpaid, tone: paid ? "warning" : "brand" },
        itemsBlock(order),
        { kind: "button", label: text.viewOrder, href: siteLink(orderPagePath(order)) },
      ],
    },
    message.sms(order.number),
  );
}
