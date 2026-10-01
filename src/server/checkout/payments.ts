import "server-only";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { issueInvoice, issueQuietly } from "@/server/invoices/invoices";
import { sendOrderConfirmation } from "@/server/notify/orders";
import type { VerifiedPayment } from "@/server/payments";

// Recording a payment's result (docs/CHUNKS.md, P1.4), whatever the
// provider. Each result is applied at most once: the payment and the order
// only move on from "created" / "pending_payment" with a conditional update,
// so a double click, a replayed request or a late webhook finds nothing to
// change and counts nothing twice.
//
// - Success: the order becomes paid, stock goes down, the ordered products
//   leave the cart, the GST invoice is issued (P1.6) and a confirmation is
//   sent (dev log).
// - Failure: the order becomes payment_failed; stock and cart don't change.
// - Success when an item no longer has the stock: recorded as a failure
//   ("out_of_stock"), with nothing taken. With a real provider this is where
//   a refund would start (see "Later" in docs/PROGRESS.md).

export type PaymentOutcome = {
  orderId: string;
  status: OrderStatus;
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
  await tx.order.updateMany({
    where: { id: orderId, status: "pending_payment" },
    data: { status: "payment_failed" },
  });
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
    select: { id: true, orderId: true, order: { select: { userId: true } } },
  });
  if (!payment) return null;
  if (ownerId !== undefined && payment.order.userId !== ownerId) return null;
  const { id: paymentId, orderId } = payment;
  const current = async (changed: boolean): Promise<PaymentOutcome> => {
    const order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true },
    });
    return { orderId, status: order.status, changed };
  };

  if (verified.outcome === "failed") {
    const changed = await db.$transaction((tx) =>
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

      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: { productId: true, quantity: true },
      });
      for (const item of items) {
        if (item.productId === null) throw new OutOfStock();
        // Takes the stock only if there's enough; the row lock it holds
        // makes concurrent orders for the last units queue up.
        const taken = await tx.$executeRaw`
          UPDATE Product SET stock = stock - ${item.quantity}, updatedAt = NOW(3)
          WHERE id = ${item.productId} AND stock >= ${item.quantity}`;
        if (taken === 0) throw new OutOfStock();
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
      }
      return true;
    });
  } catch (error) {
    if (error instanceof OutOfStock) {
      const failed = await db.$transaction((tx) => fail(tx, paymentId, orderId, "out_of_stock"));
      return current(failed);
    }
    // The order stopped waiting for payment (e.g. cancelled): nothing applied.
    if (error instanceof NotPending) return current(false);
    throw error;
  }

  if (changed) {
    await issueQuietly(issueInvoice, orderId);
    try {
      await sendOrderConfirmation(orderId);
    } catch (error) {
      console.error("completePayment: confirmation not sent.", error);
    }
  }
  return current(changed);
}
