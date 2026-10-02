import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, FlaskConical } from "lucide-react";
import { retryPaymentAction } from "@/app/(site)/checkout/actions";
import { LogoPreview } from "@/components/site/brand/logo-preview";
import { OrderSummary } from "@/components/site/cart/order-summary";
import { SubmitButton } from "@/components/site/checkout/submit-button";
import { OrderDocuments } from "@/components/site/orders/order-documents";
import { OrderStatusBadge } from "@/components/site/orders/order-status-badge";
import { Badge, Eyebrow } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Stepper } from "@/components/ui/stepper";
import { brand as copy } from "@/content/brand";
import { checkout as checkoutCopy } from "@/content/checkout";
import type { OrderStatus } from "@/generated/prisma/enums";
import { addressLines, addressPhone } from "@/lib/address";
import { isImageLogo } from "@/lib/brand";
import { formatDate, formatDateTime, formatPaise } from "@/lib/format";
import { isOrderId } from "@/lib/orders";
import { requireUser } from "@/server/auth/session";
import { readBrandOrderForUser } from "@/server/brand/orders";
import { readOrderDocuments } from "@/server/invoices/invoices";

const text = copy.detail;

export const metadata: Metadata = {
  title: text.eyebrow,
  robots: { index: false, follow: false },
};

/** Where the order is on Placed → Paid → Label proof → Production → Dispatch. */
function timelineStep(status: OrderStatus): number {
  switch (status) {
    case "pending_payment":
    case "payment_failed":
      return 1;
    case "paid":
      return 2;
    case "processing":
      return 3;
    case "shipped":
      return 4;
    case "delivered":
      return 5;
    case "cancelled":
    case "returned":
      return 0;
  }
}

/**
 * One of the user's brand orders (P2.1): its progress, what happens next,
 * the packaging details with the logo, and the delivery address. Someone
 * else's order (or a store order) is a 404.
 */
export default async function BrandOrderPage({ params }: PageProps<"/my-brand/[id]">) {
  const { id } = await params;
  if (!isOrderId(id)) notFound();
  const { user } = await requireUser(`/my-brand/${id}`);
  const order = await readBrandOrderForUser(user.id, id);
  if (!order) notFound();
  const documents = await readOrderDocuments(order);

  const unpaid = order.status === "pending_payment" || order.status === "payment_failed";
  const unitLabel = order.unitLabel ?? "";
  const logoSrc = `/api/brand-orders/${order.id}/logo`;
  const next =
    order.status in text.next ? text.next[order.status as keyof typeof text.next] : null;
  const details = order.details;
  const rows: [string, string | null][] = details
    ? [
        [text.brandName, details.brandName],
        [text.tagline, details.tagline],
        [text.marketedBy, [details.marketedByName, details.marketedByAddress].filter(Boolean).join(", ") || null],
        [text.contactPhone, details.contactPhone],
        [text.notes, details.notes],
      ]
    : [];
  // The order's own snapshot: one line at one GST rate.
  const totals = {
    subtotalPaise: order.subtotalPaise,
    gst: [{ rate: order.gstRate, taxablePaise: order.subtotalPaise - order.taxPaise, taxPaise: order.taxPaise }],
    shippingPaise: order.shippingPaise,
    totalPaise: order.totalPaise,
  };

  return (
    <div className="shell py-8 sm:py-12">
      <Link
        href="/my-brand"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-teal hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {text.back}
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>{text.eyebrow}</Eyebrow>
          <h1 className="mt-2 text-h2 break-words text-ink">{order.brandName}</h1>
          <p className="mt-1 text-body text-muted">
            <span className="font-mono font-bold text-ink">{order.number}</span> ·{" "}
            {copy.myBrand.placedOn(formatDate(order.createdAt))}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <Card className="mt-6">
        {order.status !== "cancelled" && order.status !== "returned" && (
          <Stepper
            label={text.timelineLabel}
            steps={[
              { label: text.timeline.placed, detail: formatDate(order.createdAt) },
              { label: text.timeline.paid, detail: order.paidAt ? formatDate(order.paidAt) : undefined },
              { label: text.timeline.proof },
              { label: text.timeline.production },
              { label: text.timeline.dispatch },
            ]}
            current={timelineStep(order.status)}
          />
        )}
        {next && <p className="mt-5 text-body text-ink">{next}</p>}
        {order.payment?.provider === "test" && order.paidAt && (
          <p className="mt-3 flex items-center gap-2 text-small text-muted">
            <Badge variant="soon">
              <FlaskConical aria-hidden className="size-3.5" />
              {checkoutCopy.pay.testBadge}
            </Badge>
            {text.testNote}
          </p>
        )}
        {order.status === "pending_payment" && (
          <Link href={`/checkout/pay/${order.id}`} className={buttonClasses({ className: "mt-5 max-sm:w-full" })}>
            {text.pay}
          </Link>
        )}
        {order.status === "payment_failed" && (
          <form action={retryPaymentAction} className="mt-5">
            <input type="hidden" name="orderId" value={order.id} />
            <SubmitButton className="max-sm:w-full">{text.tryAgain}</SubmitButton>
          </form>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <h2 className="text-h3 text-ink">{text.packaging}</h2>
            {details && (
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex flex-col gap-2">
                  <LogoPreview
                    src={logoSrc}
                    name={details.logoName}
                    contentType={details.logoContentType}
                    sizeBytes={details.logoSizeBytes}
                    alt={copy.packaging.logo.previewAlt(details.brandName)}
                  />
                  {isImageLogo(details.logoContentType) && (
                    <a
                      href={`${logoSrc}?download=1`}
                      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-teal hover:underline"
                    >
                      <Download aria-hidden className="size-4" />
                      {text.downloadLogo}
                    </a>
                  )}
                </div>
                <dl className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
                  {rows.map(([label, value]) =>
                    value ? (
                      <div key={label} className="min-w-0">
                        <dt className="text-small font-bold text-muted">{label}</dt>
                        <dd className="break-words whitespace-pre-line text-ink">{value}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-h3 text-ink">{checkoutCopy.confirmation.deliverTo}</h2>
            <address className="mt-3 text-sm text-ink not-italic">
              <span className="block font-extrabold">{order.address.name}</span>
              {addressLines(order.address).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              <span className="mt-1 block text-small text-muted">
                {checkoutCopy.address.phoneLine(addressPhone(order.address))}
              </span>
            </address>
          </Card>

          <OrderDocuments
            orderId={order.id}
            orderNumber={order.number}
            documents={documents}
            showUnpaidNote={unpaid}
          />
        </div>

        <OrderSummary
          totals={totals}
          items={[
            {
              key: order.productSlug,
              name: order.productName,
              detail: copy.review.itemDetail(order.quantity, unitLabel, formatPaise(order.unitPaise)),
              totalPaise: order.subtotalPaise,
            },
          ]}
          itemsLabel={checkoutCopy.confirmation.items}
          hideNote
          className="lg:sticky lg:top-40"
        >
          {order.payment && (
            <p className="text-small text-muted">
              {text.payment}: {checkoutCopy.status[order.status]}
              {order.paidAt ? ` · ${formatDateTime(order.paidAt)}` : ""}
            </p>
          )}
        </OrderSummary>
      </div>
    </div>
  );
}
