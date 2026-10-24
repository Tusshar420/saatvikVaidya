import "server-only";
import { db } from "@/server/db";
import { getPaymentProviderByName } from "@/server/payments";

// Refunds (P2.2): a cancelled brand order's payment is given back through
// the provider that took it (not the current PAYMENT_PROVIDER). With the
// test provider no money moves; only a made-up refund reference is kept on
// the payment. Done once: a payment that
// already has a refund is left alone.

/** Refunds the order's successful payment. Returns the refund reference, or null if there was nothing to refund. */
export async function refundOrderPayment(orderId: string): Promise<string | null> {
  const payment = await db.payment.findFirst({
    where: { orderId, status: "succeeded", refundedAt: null },
    orderBy: { attempt: "desc" },
    select: { id: true, provider: true, reference: true, amountPaise: true },
  });
  if (!payment) return null;
  const refund = await getPaymentProviderByName(payment.provider).refundPayment({
    reference: payment.reference,
    amountPaise: payment.amountPaise,
  });
  // Recorded only if no one else did it first.
  const recorded = await db.payment.updateMany({
    where: { id: payment.id, refundedAt: null },
    data: { refundReference: refund.reference, refundedAt: new Date() },
  });
  return recorded.count > 0 ? refund.reference : null;
}
