import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { retryPaymentAction, simulatePaymentAction } from "@/app/(site)/checkout/actions";
import { OrderItemsSummary } from "@/components/site/checkout/order-items-summary";
import { SubmitButton } from "@/components/site/checkout/submit-button";
import { Badge, Eyebrow } from "@/components/ui/badge";

import { ComingSoon } from "@/components/ui/empty-state";
import { brand as brandCopy } from "@/content/brand";
import { checkout as copy } from "@/content/checkout";
import { formatPaise } from "@/lib/format";
import { checkoutPathFor, isOrderId } from "@/lib/orders";
import { requireUser } from "@/server/auth/session";
import { readOrderForUser } from "@/server/checkout/orders";
import { getSetting } from "@/server/content/settings";
import { getPaymentProvider } from "@/server/payments";

const text = copy.pay;

export const metadata: Metadata = {
  title: text.metaTitle,
  robots: { index: false, follow: false },
};

/**
 * The payment screen for an order waiting for payment. With the test
 * provider it says plainly that no money is taken and offers "Simulate
 * success" and "Simulate failure". Paid and failed orders go to their own
 * pages. Only the order's owner can see it; anyone else gets a 404.
 */
export default async function PayPage({ params }: PageProps<"/checkout/pay/[orderId]">) {
  const { orderId } = await params;
  if (!isOrderId(orderId)) notFound();
  const { user } = await requireUser(`/checkout/pay/${orderId}`);
  const order = await readOrderForUser(user.id, orderId);
  if (!order) notFound();
  if (order.status !== "pending_payment" && order.status !== "cancelled") {
    redirect(checkoutPathFor(order.id, order.status, order.type));
  }

  const provider = getPaymentProvider();
  const live = order.payment?.status === "created" ? order.payment : null;
  const phone = await getSetting("contact.phone");

  return (
    <div className="shell py-8 sm:py-12">
      <Eyebrow>{text.eyebrow}</Eyebrow>
      <h1 className="mt-2 text-h2 text-ink">{text.title}</h1>
      <p className="mt-2 text-body text-muted">{text.order(order.number)}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8">
        <section
          aria-label={text.amount}
          className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
        >
          <p className="text-small font-bold text-muted">{text.amount}</p>
          <p className="text-4xl font-extrabold tracking-[-0.02em] text-ink">
            {formatPaise(order.totalPaise)}
          </p>

          {order.status === "cancelled" ? (
            <p className="mt-5 text-body text-ink">
              {text.noAttempt}
            </p>
          ) : !provider.isAvailable() ? (
            <ComingSoon
              as="h2"
              title={copy.paymentsOff.title}
              description={copy.paymentsOff.line(phone)}
              className="mt-5"
            />
          ) : live ? (
            <div className="mt-5 rounded-lg border-2 border-dashed border-orange/60 bg-orange-soft/50 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="soon">
                  <FlaskConical aria-hidden className="size-3.5" />
                  {text.testBadge}
                </Badge>
                <span className="text-small text-muted">{text.attempt(live.attempt)}</span>
              </div>
              <h2 className="mt-3 text-h3 text-ink">
                {text.testTitle}
              </h2>
              <p className="mt-1.5 text-body text-ink">{text.testLine}</p>
              <div className="mt-5 flex flex-wrap gap-3 max-sm:*:w-full">
                <form action={simulatePaymentAction}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="reference" value={live.reference} />
                  <input type="hidden" name="outcome" value="success" />
                  <SubmitButton className="max-sm:w-full">{text.success}</SubmitButton>
                </form>
                <form action={simulatePaymentAction}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="reference" value={live.reference} />
                  <input type="hidden" name="outcome" value="failure" />
                  <SubmitButton variant="secondary" className="max-sm:w-full">
                    {text.failure}
                  </SubmitButton>
                </form>
              </div>
            </div>
          ) : (
            <form action={retryPaymentAction} className="mt-5">
              <input type="hidden" name="orderId" value={order.id} />
              <SubmitButton className="max-sm:w-full">{text.start}</SubmitButton>
            </form>
          )}
        </section>

        <OrderItemsSummary order={order} className="lg:sticky lg:top-40" />
      </div>
      <p className="mt-6">
        {order.type === "brand" ? (
          <Link href={`/my-brand/${order.id}`} className="inline-flex min-h-11 items-center text-sm font-bold text-brand hover:underline">
            {brandCopy.checkout.backToMyBrand}
          </Link>
        ) : (
          <Link href="/cart" className="inline-flex min-h-11 items-center text-sm font-bold text-brand hover:underline">
            {copy.failed.backToCart}
          </Link>
        )}
      </p>
    </div>
  );
}
