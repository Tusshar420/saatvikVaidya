import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleCheck, FlaskConical } from "lucide-react";
import { OrderItemsSummary } from "@/components/site/checkout/order-items-summary";
import { Eyebrow } from "@/components/ui/badge";
import { ButtonArrow, ButtonGroup, buttonClasses } from "@/components/ui/button";
import { checkout as copy } from "@/content/checkout";
import { addressLines, addressPhone } from "@/lib/address";
import { formatDateTime, formatPaise } from "@/lib/format";
import { checkoutPathFor, isOrderId } from "@/lib/orders";
import { requireUser } from "@/server/auth/session";
import { readOrderForUser } from "@/server/checkout/orders";

const text = copy.confirmation;

export const metadata: Metadata = {
  title: text.metaTitle,
  robots: { index: false, follow: false },
};

/** After a successful payment: the order number, what was paid and where it's going. */
export default async function ConfirmationPage({
  params,
}: PageProps<"/checkout/confirmation/[orderId]">) {
  const { orderId } = await params;
  if (!isOrderId(orderId)) notFound();
  const { user } = await requireUser(`/checkout/confirmation/${orderId}`);
  const order = await readOrderForUser(user.id, orderId);
  if (!order) notFound();
  const path = checkoutPathFor(order.id, order.status);
  if (!path.startsWith("/checkout/confirmation/")) redirect(path);

  return (
    <div className="shell py-8 sm:py-12">
      <div className="flex items-start gap-3">
        <CircleCheck aria-hidden className="mt-1 size-8 shrink-0 text-green" />
        <div>
          <Eyebrow>{text.eyebrow}</Eyebrow>
          <h1 className="mt-2 text-h2 text-ink">
            {text.title} <em className="block text-teal not-italic">{text.titleEmphasis}</em>
          </h1>
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-body-lg text-ink">{text.line(order.number)}</p>
      {order.payment?.provider === "test" && (
        <p className="mt-3 flex w-fit items-center gap-2 rounded-lg bg-orange-soft px-3.5 py-2.5 text-small font-semibold text-orange-ink">
          <FlaskConical aria-hidden className="size-4 shrink-0" />
          {text.testNote}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8">
        <section
          aria-label={text.orderNumber}
          className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
        >
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-small text-muted">{text.orderNumber}</dt>
              <dd className="text-lg font-extrabold text-ink">{order.number}</dd>
            </div>
            <div>
              <dt className="text-small text-muted">{text.paid}</dt>
              <dd className="text-lg font-extrabold text-ink">{formatPaise(order.totalPaise)}</dd>
            </div>
            <div>
              <dt className="text-small text-muted">{text.placedOn}</dt>
              <dd className="font-semibold text-ink">{formatDateTime(order.createdAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-small text-muted">{text.deliverTo}</dt>
              <dd className="text-ink">
                <span className="block font-extrabold">{order.address.name}</span>
                {addressLines(order.address).map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
                <span className="block text-small text-muted">
                  {copy.address.phoneLine(addressPhone(order.address))}
                </span>
              </dd>
            </div>
          </dl>
          <p className="mt-5 border-t border-line pt-4 text-small text-muted">{text.trackingSoon}</p>
          <ButtonGroup className="mt-5">
            <Link href="/products" className={buttonClasses()}>
              {text.continueShopping}
              <ButtonArrow />
            </Link>
            <Link href="/" className={buttonClasses({ variant: "secondary" })}>
              {text.backHome}
            </Link>
          </ButtonGroup>
        </section>

        <OrderItemsSummary order={order} />
      </div>
    </div>
  );
}
