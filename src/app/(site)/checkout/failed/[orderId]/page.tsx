import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { retryPaymentAction } from "@/app/(site)/checkout/actions";
import { OrderItemsSummary } from "@/components/site/checkout/order-items-summary";
import { SubmitButton } from "@/components/site/checkout/submit-button";
import { Eyebrow } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { brand as brandCopy } from "@/content/brand";
import { checkout as copy } from "@/content/checkout";
import { checkoutPathFor, isOrderId } from "@/lib/orders";
import { requireUser } from "@/server/auth/session";
import { readOrderForUser } from "@/server/checkout/orders";

const text = copy.failed;

export const metadata: Metadata = {
  title: text.metaTitle,
  robots: { index: false, follow: false },
};

/**
 * After a failed payment. The order is kept; "Try again" starts a new
 * attempt on it and "Back to cart" goes back to the (unchanged) cart.
 */
export default async function PaymentFailedPage({
  params,
}: PageProps<"/checkout/failed/[orderId]">) {
  const { orderId } = await params;
  if (!isOrderId(orderId)) notFound();
  const { user } = await requireUser(`/checkout/failed/${orderId}`);
  const order = await readOrderForUser(user.id, orderId);
  if (!order) notFound();
  if (order.status !== "payment_failed") redirect(checkoutPathFor(order.id, order.status, order.type));
  const outOfStock = order.payment?.failureReason === "out_of_stock";

  return (
    <div className="shell py-8 sm:py-12">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden className="mt-1 size-8 shrink-0 text-danger" />
        <div>
          <Eyebrow>{text.eyebrow}</Eyebrow>
          <h1 className="mt-2 text-h2 text-ink">
            {text.title} <em className="block text-teal not-italic">{text.titleEmphasis}</em>
          </h1>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8">
        <section
          aria-label={text.eyebrow}
          className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
        >
          <p className="text-body-lg text-ink">
            {order.type === "brand" ? brandCopy.checkout.failedLine(order.number) : text.line(order.number)}
          </p>
          {outOfStock && (
            <p className="mt-3 rounded-lg bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">
              {text.outOfStock}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3 max-sm:*:w-full">
            <form action={retryPaymentAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <SubmitButton className="max-sm:w-full">{text.tryAgain}</SubmitButton>
            </form>
            {order.type === "brand" ? (
              <Link href={`/my-brand/${order.id}`} className={buttonClasses({ variant: "secondary" })}>
                {brandCopy.checkout.backToMyBrand}
              </Link>
            ) : (
              <Link href="/cart" className={buttonClasses({ variant: "secondary" })}>
                {text.backToCart}
              </Link>
            )}
          </div>
        </section>

        <OrderItemsSummary order={order} />
      </div>
    </div>
  );
}
