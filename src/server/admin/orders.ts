import "server-only";
import { z } from "zod";
import type { OrderStatus, OrderType, Prisma } from "@/generated/prisma/client";
import { canCancelBrandStage, type BrandStageKey } from "@/lib/brand-stage";
import { isOrderId } from "@/lib/orders";
import { cancelStageInTx } from "@/server/brand/stages";
import { refundOrderPayment } from "@/server/checkout/refunds";
import { ledgerTransaction, releaseCoins, reverseOrderEarnings } from "@/server/coins/ledger";
import { db } from "@/server/db";
import { releaseBrandOrder, releaseOrderStock, returnOrderStock } from "@/server/inventory/orders";
import { issueCreditNote, issueQuietly } from "@/server/invoices/invoices";
import { sendOrderCancelled } from "@/server/notify/orders";
import { getShippingProvider } from "@/server/shipping";
import { logAdminAction } from "./audit";

// Orders in the admin panel (/admin/orders, docs/CHUNKS.md P1.5): the list
// with its filters, one order in full, and cancelling. Callers (pages and
// server actions) check the admin session first and pass the admin's id as
// `actorId`. Shipments are in src/server/shipping/shipments.ts.

export const orderStatuses = [
  "pending_payment",
  "payment_failed",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "returned",
  "cancelled",
] as const satisfies readonly OrderStatus[];

export const ADMIN_ORDERS_PAGE_SIZE = 25;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const isoDate = z.iso.date();

/** Invalid values are dropped, so a bad link still shows the page. */
export const orderFiltersSchema = z.object({
  q: z
    .preprocess(first, z.string().trim().max(100).optional())
    .transform((value) => value || undefined)
    .catch(undefined),
  status: z.preprocess(first, z.enum(orderStatuses).optional()).catch(undefined),
  from: z.preprocess(first, isoDate.optional()).catch(undefined),
  to: z.preprocess(first, isoDate.optional()).catch(undefined),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000).optional()).catch(undefined),
});

export type OrderFilters = z.infer<typeof orderFiltersSchema>;

/** Start of a day in India ("2026-10-01" -> 1 Oct 00:00 IST). */
const istDayStart = (day: string) => new Date(`${day}T00:00:00+05:30`);

/** Where clause for the filters, for one order type (store orders or brand orders). */
export function filtersWhere(
  filters: OrderFilters,
  type: OrderType = "store",
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { type };
  if (filters.status) where.status = filters.status;
  if (filters.from || filters.to) {
    where.createdAt = {
      gte: filters.from ? istDayStart(filters.from) : undefined,
      // Up to the end of the "to" day.
      lt: filters.to
        ? new Date(istDayStart(filters.to).getTime() + 24 * 3600_000)
        : undefined,
    };
  }
  if (filters.q) {
    const q = filters.q;
    where.OR = [
      { number: { contains: q.toUpperCase() } },
      { shipName: { contains: q } },
      { user: { is: { email: { contains: q } } } },
      { user: { is: { name: { contains: q } } } },
    ];
    // Only a phone-like query searches phones: the digits inside an order
    // number ("SV-AB3C7DEF" → "37") would otherwise match unrelated orders.
    const digits = q.replace(/\D/g, "");
    if (/^[\d\s+()-]+$/.test(q) && digits.length >= 3) {
      where.OR.push({ shipPhone: { contains: digits } });
    }
  }
  return where;
}

export type AdminOrderRow = {
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: Date;
  totalPaise: number;
  customerName: string;
  customerContact: string | null;
  itemCount: number;
};

export async function listAdminOrders(filters: OrderFilters): Promise<{
  orders: AdminOrderRow[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const where = filtersWhere(filters);
  const total = await db.order.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_ORDERS_PAGE_SIZE));
  const page = Math.min(filters.page ?? 1, pageCount);
  const rows = await db.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ADMIN_ORDERS_PAGE_SIZE,
    take: ADMIN_ORDERS_PAGE_SIZE,
    select: {
      id: true,
      number: true,
      status: true,
      createdAt: true,
      totalPaise: true,
      shipName: true,
      shipPhone: true,
      user: { select: { name: true, email: true } },
      _count: { select: { items: true } },
    },
  });
  return {
    orders: rows.map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      createdAt: row.createdAt,
      totalPaise: row.totalPaise,
      customerName: row.user?.name ?? row.shipName,
      customerContact: row.shipPhone,
      itemCount: row._count.items,
    })),
    total,
    page,
    pageCount,
  };
}

/** One order with everything the admin detail page shows. */
export async function readAdminOrder(orderId: string) {
  if (!isOrderId(orderId)) return null;
  return db.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, name: true, email: true, phoneNumber: true } },
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: { attempt: "desc" } },
      brandDetails: { select: { stage: true } },
      shipment: {
        include: { events: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] } },
      },
    },
  });
}

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof readAdminOrder>>>;

/** Order statuses an admin may cancel from (nothing has left the warehouse). */
export const cancellableStatuses = [
  "pending_payment",
  "payment_failed",
  "paid",
  "processing",
] as const satisfies readonly OrderStatus[];

/** Shipment steps that still allow cancelling the order. */
const cancellableShipment = ["created", "packed"] as const;

export function canCancelOrder(order: {
  status: OrderStatus;
  shipment: { status: string } | null;
  /** A brand order's stage (P2.2): it can only be cancelled before production. */
  brandStage?: BrandStageKey | null;
}): boolean {
  return (
    (cancellableStatuses as readonly string[]).includes(order.status) &&
    (!order.shipment || (cancellableShipment as readonly string[]).includes(order.shipment.status)) &&
    (!order.brandStage || canCancelBrandStage(order.brandStage))
  );
}

class StageMoved extends Error {}

export type CancelResult =
  | { ok: true; changed: boolean; restocked: boolean }
  | { ok: false; error: "not_found" | "not_allowed" };

/**
 * Cancels an order that hasn't shipped. Stock that its payment took goes
 * back, open payment attempts are closed, a shipment not yet handed over is
 * called off, a paid order gets a credit note (P1.6), and the buyer is told. Applied once: a second cancel finds the
 * order already cancelled and changes nothing.
 *
 * With test payments no money moved; a real provider's refund belongs here
 * (see "Later" in docs/PROGRESS.md).
 */
export async function cancelOrder(
  actorId: string,
  orderId: string,
  note: string | null = null,
): Promise<CancelResult> {
  if (!isOrderId(orderId)) return { ok: false, error: "not_found" };
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      type: true,
      userId: true,
      shipment: { select: { id: true, status: true, awb: true, provider: true } },
      brandDetails: { select: { stage: true } },
    },
  });
  if (!order) return { ok: false, error: "not_found" };
  if (order.status === "cancelled") return { ok: true, changed: false, restocked: false };
  const brandStage = order.brandDetails?.stage ?? null;
  if (!canCancelOrder({ ...order, brandStage })) return { ok: false, error: "not_allowed" };

  const now = new Date();
  const outcome = await ledgerTransaction(async (tx) => {
    // A brand order's stage (P2.2) is cancelled with it and logged, first,
    // so it takes its locks in the same order as a stage change does.
    if (brandStage) {
      const stageMoved = await cancelStageInTx(tx, { orderId, from: brandStage, actorId, note });
      if (!stageMoved) throw new StageMoved();
    }
    // Claim the cancel from the status we saw, so it happens once.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: "cancelled", cancelledAt: now },
    });
    if (claimed.count === 0) {
      if (brandStage) throw new StageMoved();
      return null;
    }

    // Paid (or being prepared): the payment took the stock, so put it back.
    // Brand orders (P2.1) are made to order and took no finished stock.
    const restocked =
      order.type === "store" && (order.status === "paid" || order.status === "processing");
    if (restocked) {
      // Back into the batches the sale came from.
      await returnOrderStock(tx, orderId, actorId, "Order cancelled");
    }
    // Stock still held (an unpaid order's hold, or a Launch order's
    // components that production hasn't used yet) is released.
    await releaseOrderStock(tx, orderId, "Order cancelled");
    if (order.type === "brand") await releaseBrandOrder(tx, orderId);
    // Coins held for the order go back; coins it earned are taken back.
    if (order.userId) {
      await releaseCoins(tx, order.userId, orderId);
      await reverseOrderEarnings(tx, order.userId, orderId);
    }
    // An unpaid order's open attempt can't be paid any more.
    await tx.payment.updateMany({
      where: { orderId, status: "created" },
      data: { status: "failed", failureReason: "cancelled", completedAt: now },
    });
    if (order.shipment) {
      const stopped = await tx.shipment.updateMany({
        where: { id: order.shipment.id, status: { in: [...cancellableShipment] } },
        data: { status: "cancelled" },
      });
      if (stopped.count > 0) {
        await tx.shipmentEvent.create({
          data: { shipmentId: order.shipment.id, status: "cancelled", actorId },
        });
      }
    }
    await logAdminAction(tx, {
      actorId,
      action: "order.cancel",
      resource: "Order",
      resourceId: orderId,
      changes: { status: { from: order.status, to: "cancelled" }, restocked: { from: null, to: restocked } },
      note,
    });
    return { restocked };
  }).catch((error: unknown) => {
    // Someone moved the order's stage first: nothing was cancelled.
    if (error instanceof StageMoved) return null;
    throw error;
  });
  if (!outcome) {
    const now = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });
    return now.status === "cancelled"
      ? { ok: true, changed: false, restocked: false }
      : { ok: false, error: "not_allowed" };
  }

  if (order.shipment) {
    await getShippingProvider()
      .cancelShipment(order.shipment.awb)
      .catch((error: unknown) => console.error("cancelOrder: shipment not called off.", error));
  }
  // A paid order has an invoice to reverse (a store order's payment took the
  // stock; a brand order was made to order and took none).
  const wasPaid = order.status === "paid" || order.status === "processing";
  if (wasPaid) await issueQuietly(issueCreditNote, orderId);
  // A brand order's payment is refunded through the provider (a test refund here).
  if (wasPaid && order.type === "brand") {
    try {
      await refundOrderPayment(orderId);
    } catch (error) {
      console.error("cancelOrder: refund not recorded.", error);
    }
  }
  try {
    await sendOrderCancelled(orderId);
  } catch (error) {
    console.error("cancelOrder: message not sent.", error);
  }
  return { ok: true, changed: true, restocked: outcome.restocked };
}

/** Orders waiting to be shipped (paid, or being prepared), for the dashboard. */
export async function countOrdersToShip(): Promise<{ total: number; toShip: number }> {
  const [total, toShip] = await Promise.all([
    db.order.count(),
    db.order.count({ where: { status: { in: ["paid", "processing"] } } }),
  ]);
  return { total, toShip };
}
