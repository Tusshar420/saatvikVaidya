import "server-only";
import { isOrderId } from "@/lib/orders";
import { completePayment } from "@/server/checkout/payments";
import { db } from "@/server/db";
import { logAdminAction } from "./audit";

// Marking an order paid by hand, for PAYMENT_PROVIDER=manual: the customer
// paid by QR code or bank transfer and an admin has seen the money arrive.
// It goes through completePayment(), the same code every provider uses, so
// stock, the cart, the GST invoice, coins and the confirmation all happen
// exactly once. Callers check the admin session first and pass the admin's id.

export type MarkPaidResult =
  | { ok: true; changed: boolean }
  | { ok: false; error: "not_found" | "not_manual" | "not_pending" | "out_of_stock" };

export async function markOrderPaid(actorId: string, orderId: string): Promise<MarkPaidResult> {
  if (!isOrderId(orderId)) return { ok: false, error: "not_found" };
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      payments: {
        where: { status: "created" },
        orderBy: { attempt: "desc" },
        take: 1,
        select: { reference: true, provider: true },
      },
    },
  });
  if (!order) return { ok: false, error: "not_found" };
  // Already paid (a double click, or another admin got there first).
  if (order.status === "paid") return { ok: true, changed: false };
  const payment = order.payments[0];
  if (order.status !== "pending_payment" || !payment) return { ok: false, error: "not_pending" };
  if (payment.provider !== "manual") return { ok: false, error: "not_manual" };

  const outcome = await completePayment({ reference: payment.reference, outcome: "succeeded" });
  if (!outcome) return { ok: false, error: "not_found" };
  // An item ran out of stock while the customer was paying: completePayment
  // recorded a failure and took nothing.
  if (outcome.status === "payment_failed") return { ok: false, error: "out_of_stock" };
  if (outcome.status !== "paid") return { ok: false, error: "not_pending" };
  if (outcome.changed) {
    await db.$transaction((tx) =>
      logAdminAction(tx, {
        actorId,
        action: "order.mark_paid",
        resource: "Order",
        resourceId: orderId,
        changes: { status: { from: "pending_payment", to: "paid" } },
      }),
    );
  }
  return { ok: true, changed: outcome.changed };
}
