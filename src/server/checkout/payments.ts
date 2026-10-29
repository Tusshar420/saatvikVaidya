import "server-only";
import type { OrderStatus, OrderType, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { earnForOrder, ledgerTransaction, releaseCoins } from "@/server/coins/ledger";
import { notifyCourseEnrolments } from "@/server/courses/courses";
import { issueInvoice, issueQuietly } from "@/server/invoices/invoices";
import { recordFirstStage } from "@/server/brand/stages";
import { StockError } from "@/server/inventory/engine";
import { releaseOrderStock, reserveBrandOrder, takeOrderStock } from "@/server/inventory/orders";
import { sendBrandOrderPaid } from "@/server/notify/brand";
import { sendOrderConfirmation } from "@/server/notify/orders";
import type { VerifiedPayment } from "@/server/payments";

// Recording a payment's result (docs/CHUNKS.md, P1.4), whatever the
// provider. Each result is applied at most once: the payment and the order
// only move on from "created" / "pending_payment" with a conditional update,
// so a double click, a replayed request or a late webhook finds nothing to
// change and counts nothing twice.
//
// - Success: the order becomes paid, the stock held for it is sold, the ordered products
//   leave the cart, the GST invoice is issued (P1.6) and a confirmation is
//   sent (dev log).
// - Failure: the order becomes payment_failed; the stock held for it is
//   released ("Try again" holds it again) and the cart doesn't change.
// - Success when an item no longer has the stock: recorded as a failure
//   ("out_of_stock"), with nothing taken. With a real provider this is where
//   a refund would start (see "Later" in docs/PROGRESS.md).
// - Brand orders (P2.1) are made to order: no finished stock is taken (the
//   components their recipes need are reserved instead), there is no
//   cart to clear and no coins are earned; the customer and the admins get
//   the brand messages instead of the store confirmation.

export type PaymentOutcome = {
  orderId: string;
  status: OrderStatus;
  type: OrderType;
  /** False when this result had already been applied (or was too late). */
  changed: boolean;
};

class OutOfStock extends Error {}
class NotPending extends Error {}

async function fail(
  tx: Prisma.TransactionClient,
  paymentId: number,
  orderId: string,
  reason: string,
): Promise<boolean> {
  const claimed = await tx.payment.updateMany({
    where: { id: paymentId, status: "created" },
    data: { status: "failed", failureReason: reason.slice(0, 40), completedAt: new Date() },
  });
  if (claimed.count === 0) return false;
  const failed = await tx.order.updateMany({
    where: { id: orderId, status: "pending_payment" },
    data: { status: "payment_failed" },
  });
  // The coins held for this attempt go back; "Try again" takes them again.
  if (failed.count > 0) {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { userId: true } });
    if (order.userId) await releaseCoins(tx, order.userId, orderId);
    await releaseOrderStock(tx, orderId, "Payment failed");
  }
  return true;
}

/**
 * Applies a verified result to its payment and order. Null if the reference
 * is unknown, or if `ownerId` is given and the order isn't theirs.
 */
export async function completePayment(
  verified: VerifiedPayment,
  ownerId?: string,
): Promise<PaymentOutcome | null> {
  const payment = await db.payment.findUnique({
    where: { reference: verified.reference },
    select: { id: true, orderId: true, order: { select: { userId: true, type: true } } },
  });
  if (!payment) return null;
  if (ownerId !== undefined && payment.order.userId !== ownerId) return null;
  const { id: paymentId, orderId } = payment;
  const isBrand = payment.order.type === "brand";
  const current = async (changed: boolean): Promise<PaymentOutcome> => {
    const order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true },
    });
    return { orderId, status: order.status, type: payment.order.type, changed };
  };

  if (verified.outcome === "failed") {
    const changed = await ledgerTransaction((tx) =>
      fail(tx, paymentId, orderId, verified.failureReason ?? "failed"),
    );
    return current(changed);
  }

  let changed = false;
  try {
    changed = await db.$transaction(async (tx) => {
      const now = new Date();
      const claimed = await tx.payment.updateMany({
        where: { id: paymentId, status: "created" },
        data: { status: "succeeded", completedAt: now },
      });
      if (claimed.count === 0) return false;
      const order = await tx.order.updateMany({
        where: { id: orderId, status: "pending_payment" },
        data: { status: "paid", paidAt: now },
      });
      if (order.count === 0) throw new NotPending();
      if (isBrand) {
        await recordFirstStage(tx, orderId);
        // Confirmed: the components its recipes need are held for production.
        await reserveBrandOrder(tx, orderId);
        return true;
      }

      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: { productId: true, ebookId: true, courseId: true, kind: true, quantity: true },
      });
      const lines: { productId: number; quantity: number }[] = [];
      for (const item of items) {
        // Ebooks (P1.8) and course seats (B1) have no stock to take.
        if (item.kind !== "product") continue;
        if (item.productId === null) throw new OutOfStock();
        lines.push({ productId: item.productId, quantity: item.quantity });
      }
      // The held stock becomes a sale (or is taken now if the hold lapsed and
      // there is still enough); the locks on the stock rows make concurrent
      // orders for the last units queue up.
      try {
        await takeOrderStock(tx, orderId, lines);
      } catch (error) {
        if (error instanceof StockError && error.code === "insufficient") throw new OutOfStock();
        throw error;
      }

      const owner = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: { userId: true },
      });
      if (owner.userId) {
        await tx.cartItem.deleteMany({
          where: {
            cart: { userId: owner.userId },
            productId: { in: items.flatMap((item) => (item.productId === null ? [] : [item.productId])) },
          },
        });
        await tx.cartItem.deleteMany({
          where: {
            cart: { userId: owner.userId },
            ebookId: { in: items.flatMap((item) => (item.ebookId === null ? [] : [item.ebookId])) },
          },
        });
        await tx.cartItem.deleteMany({
          where: {
            cart: { userId: owner.userId },
            courseId: { in: items.flatMap((item) => (item.courseId === null ? [] : [item.courseId])) },
          },
        });
      }
      return true;
    });
  } catch (error) {
    if (error instanceof OutOfStock) {
      const failed = await ledgerTransaction((tx) => fail(tx, paymentId, orderId, "out_of_stock"));
      return current(failed);
    }
    // The order stopped waiting for payment (e.g. cancelled): nothing applied.
    if (error instanceof NotPending) return current(false);
    throw error;
  }

  if (changed) {
    await issueQuietly(issueInvoice, orderId);
    if (!isBrand) {
      await earnForOrder(orderId, "paid").catch((error: unknown) => {
        console.error("completePayment: coins not credited.", error);
      });
    }
    try {
      await (isBrand ? sendBrandOrderPaid(orderId) : sendOrderConfirmation(orderId));
    } catch (error) {
      console.error("completePayment: confirmation not sent.", error);
    }
    if (!isBrand) {
      await notifyCourseEnrolments(orderId).catch((error: unknown) => {
        console.error("completePayment: course notifications not sent.", error);
      });
    }
  }
  return current(changed);
}
