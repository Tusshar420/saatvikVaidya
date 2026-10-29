import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, FlaskConical, Phone } from "lucide-react";
import { OrderItemsSummary } from "@/components/site/checkout/order-items-summary";
import { OrderDocuments } from "@/components/site/orders/order-documents";
import { OrderStatusBadge } from "@/components/site/orders/order-status-badge";
import { TrackingTimeline } from "@/components/site/orders/tracking-timeline";
import { Eyebrow } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { checkout as checkoutCopy } from "@/content/checkout";
import { orders as copy } from "@/content/orders";
import { addressLines, addressPhone } from "@/lib/address";
import { formatDateTime, formatPaise } from "@/lib/format";
import { checkoutPathFor, isOrderId } from "@/lib/orders";
import { telHref } from "@/lib/phone";
import { requireUser } from "@/server/auth/session";
import { readOrderForUser } from "@/server/checkout/orders";
import { getSetting } from "@/server/content/settings";
import { readOrderDocuments } from "@/server/invoices/invoices";
import { readTrackingForUser } from "@/server/orders/tracking";
import { EbookCard } from "@/components/site/ebooks/ebook-card";
import { courses as courseCopy } from "@/content/courses";
import { ebooks as ebookCopy } from "@/content/ebooks";
import { courseHref } from "@/lib/courses";
import { readOrderEbooks } from "@/server/ebooks/ebooks";

const text = copy.detail;

export const metadata: Metadata = {
  title: copy.list.metaTitle,
  robots: { index: false, follow: false },
};

/** One of the buyer's orders: delivery timeline, address, payment and items. 404 for anyone else. */
export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  if (!isOrderId(id)) notFound();
  const { user } = await requireUser(`/orders/${id}`);
  const [order, tracking, phone] = await Promise.all([
    readOrderForUser(user.id, id),
    readTrackingForUser(user.id, id),
    getSetting("contact.phone"),
  ]);
  if (!order || !tracking) notFound();
  // Brand orders (P2.1) have their own page with the logo and label details.
  if (order.type === "brand") redirect(`/my-brand/${order.id}`);
  const unpaid = order.status === "pending_payment" || order.status === "payment_failed";
  const ebookIds = order.items.flatMap((item) =>
    item.kind === "ebook" && item.ebookId !== null ? [item.ebookId] : [],
  );
  const ebookTitles = order.items.flatMap((item) => (item.kind === "ebook" ? [item.productName] : []));
  // Course lines keep the course's key in productSlug.
  const courseLines = order.items.filter((item) => item.kind === "course");
  // Ebooks and courses only: nothing to deliver, so no delivery timeline.
  const digitalOnly = order.items.every((item) => item.kind !== "product");
  const delivered = order.paidAt !== null && order.status !== "cancelled";
  const [documents, orderEbooks] = await Promise.all([
    readOrderDocuments(order),
    delivered ? readOrderEbooks({ id: user.id, role: user.role ?? "user" }, ebookIds) : [],
  ]);

  return (
    <div className="shell py-8 sm:py-12">
      <Link
        href="/orders"
        className={buttonClasses({ variant: "link", className: "-ml-1 min-h-11 px-1" })}
      >
        <ChevronLeft aria-hidden className="size-4" />
        {text.back}
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>{text.eyebrow}</Eyebrow>
          <h1 className="mt-2 font-mono text-h2 break-words text-ink">{order.number}</h1>
        </div>
        <OrderStatusBadge status={order.status} className="mb-1.5" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          {!digitalOnly && (
            <Card as="section" aria-labelledby="order-tracking">
              <h2 id="order-tracking" className="text-h3 text-ink">
                {text.tracking}
              </h2>
              <TrackingTimeline tracking={tracking} headingLevel="h3" className="mt-4" />
              {unpaid && (
                <Link href={checkoutPathFor(order.id, order.status)} className={buttonClasses({ className: "mt-5 max-sm:w-full" })}>
                  {text.payNow}
                </Link>
              )}
            </Card>
          )}

          {ebookTitles.length > 0 && (
            <Card as="section" aria-labelledby="order-ebooks">
              <h2 id="order-ebooks" className="text-h3 text-ink">
                {ebookCopy.order.title}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {delivered
                  ? ebookCopy.order.ready
                  : order.status === "cancelled"
                    ? ebookCopy.order.cancelled
                    : ebookCopy.order.unpaid}
              </p>
              {delivered ? (
                <ul aria-label={ebookCopy.order.title} className="mt-4 flex flex-col gap-3">
                  {orderEbooks.map((ebook) => (
                    <EbookCard key={ebook.id} ebook={ebook} headingLevel="h3" layout="row" />
                  ))}
                </ul>
              ) : (
                <ul className="mt-3 list-disc pl-5 text-sm text-ink">
                  {ebookTitles.map((title, index) => (
                    <li key={`${title}-${index}`}>{title}</li>
                  ))}
                </ul>
              )}
              {digitalOnly && unpaid && (
                <Link href={checkoutPathFor(order.id, order.status)} className={buttonClasses({ className: "mt-5 max-sm:w-full" })}>
                  {text.payNow}
                </Link>
              )}
            </Card>
          )}

          {courseLines.length > 0 && (
            <Card as="section" aria-labelledby="order-courses">
              <h2 id="order-courses" className="text-h3 text-ink">
                {courseCopy.order.title}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {delivered
                  ? courseCopy.order.ready
                  : order.status === "cancelled"
                    ? courseCopy.order.cancelled
                    : courseCopy.order.unpaid}
              </p>
              <ul aria-label={courseCopy.order.title} className="mt-3 flex flex-col gap-2 text-sm">
                {courseLines.map((item) => (
                  <li key={item.productSlug} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{item.productName}</span>
                    {delivered && (
                      <Link href={courseHref(item.productSlug)} className="font-bold text-brand underline-offset-2 hover:underline">
                        {courseCopy.account.open}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              {digitalOnly && unpaid && ebookTitles.length === 0 && (
                <Link href={checkoutPathFor(order.id, order.status)} className={buttonClasses({ className: "mt-5 max-sm:w-full" })}>
                  {text.payNow}
                </Link>
              )}
            </Card>
          )}

          <Card as="section" aria-label={text.deliverTo}>
            <dl className="grid gap-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-small text-muted">{text.placedOn}</dt>
                <dd className="font-semibold text-ink">{formatDateTime(order.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-small text-muted">{text.total}</dt>
                <dd className="text-lg font-extrabold text-ink">{formatPaise(order.totalPaise)}</dd>
              </div>
              <div>
                <dt className="text-small text-muted">{text.deliverTo}</dt>
                <dd className="text-ink">
                  <span className="block font-extrabold">{order.address.name}</span>
                  {addressLines(order.address).map((line) => (
                    <span key={line} className="block break-words">
                      {line}
                    </span>
                  ))}
                  <span className="block text-small text-muted">
                    {checkoutCopy.address.phoneLine(addressPhone(order.address))}
                  </span>
                </dd>
              </div>
              {order.payment && (
                <div>
                  <dt className="text-small text-muted">{text.payment}</dt>
                  <dd className="text-ink">
                    <span className="block font-semibold">
                      {text.paymentStatus[order.payment.status]}
                    </span>
                    <span className="block text-small text-muted">
                      {text.paymentLine(order.payment.provider, order.payment.attempt)}
                    </span>
                    {order.payment.provider === "test" && order.payment.status === "succeeded" && (
                      <span className="mt-1 flex items-center gap-1.5 text-small text-orange-ink">
                        <FlaskConical aria-hidden className="size-4 shrink-0" />
                        {text.testNote}
                      </span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
              {text.help}{" "}
              <a
                href={telHref(phone)}
                className="inline-flex min-h-11 items-center gap-1.5 font-bold text-brand underline-offset-4 hover:underline"
              >
                <Phone aria-hidden className="size-4" />
                {text.call(phone)}
              </a>
            </p>
          </Card>

          <OrderDocuments
            orderId={order.id}
            orderNumber={order.number}
            documents={documents}
            showUnpaidNote={unpaid}
          />
        </div>

        <OrderItemsSummary order={order} />
      </div>
    </div>
  );
}
