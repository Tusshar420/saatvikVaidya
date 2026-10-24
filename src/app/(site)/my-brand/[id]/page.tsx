import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, FlaskConical } from "lucide-react";
import { retryPaymentAction } from "@/app/(site)/checkout/actions";
import { OrderLabels } from "@/components/site/brand/order-labels";
import { LogoPreview } from "@/components/site/brand/logo-preview";
import { ProofDecision } from "@/components/site/brand/proof-decision";
import { ProofList } from "@/components/site/brand/proof-list";
import { OrderSummary } from "@/components/site/cart/order-summary";
import { SubmitButton } from "@/components/site/checkout/submit-button";
import { OrderDocuments } from "@/components/site/orders/order-documents";
import { OrderStatusBadge } from "@/components/site/orders/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { LaunchHero } from "@/components/site/brand/launch-hero";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Stepper } from "@/components/ui/stepper";
import { brand as copy } from "@/content/brand";
import { checkout as checkoutCopy } from "@/content/checkout";
import type { BrandStage } from "@/generated/prisma/enums";
import { addressLines, addressPhone } from "@/lib/address";
import { isImageLogo } from "@/lib/brand";
import { customerStepIndex } from "@/lib/brand-stage";
import { formatDate, formatDateTime, formatPaise } from "@/lib/format";
import { isOrderId } from "@/lib/orders";
import { requireUser } from "@/server/auth/session";
import { readBrandOrderForUser } from "@/server/brand/orders";
import { readBrandStages } from "@/server/brand/stages";
import { readOrderDocuments } from "@/server/invoices/invoices";

const text = copy.detail;
const proofText = copy.proof;

export const metadata: Metadata = {
  title: text.eyebrow,
  robots: { index: false, follow: false },
};

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
  const [documents, stages] = await Promise.all([readOrderDocuments(order), readBrandStages(order.id)]);
  if (!stages) notFound();
  const stage: BrandStage = stages.stage;
  const paid = order.paidAt !== null && order.status !== "pending_payment" && order.status !== "payment_failed";
  const latestProof = stages.proofs[0];
  const decidable = stage === "proof_sent" && latestProof?.status === "pending";
  const shipment = stages.order.shipment;

  const unpaid = order.status === "pending_payment" || order.status === "payment_failed";
  const logoSrc = `/api/brand-orders/${order.id}/logo`;
  const next = paid
    ? text.stageNext[stage]
    : order.status in text.next
      ? text.next[order.status as keyof typeof text.next]
      : null;
  const details = order.details;
  const rows: [string, string | null][] = details
    ? [
        [text.brandName, details.brandName],
        [text.tagline, details.tagline],
        [text.marketedBy, [details.marketedByName, details.marketedByAddress].filter(Boolean).join(", ") || null],
        [text.contactPhone, details.contactPhone],
        [text.licenceNumbers, details.licenceNumbers],
        [text.shortDescription, details.shortDescription],
        [text.longDescription, details.longDescription],
        [text.colours, [details.primaryColour, details.secondaryColour].filter(Boolean).join(", ").toUpperCase() || null],
        [text.notes, details.notes],
      ]
    : [];
  // The order's own snapshot, GST grouped by rate.
  const totals = {
    subtotalPaise: order.subtotalPaise,
    gst: order.gst,
    shippingPaise: order.shippingPaise,
    totalPaise: order.totalPaise,
  };

  return (
    <>
    <LaunchHero
      kicker={text.eyebrow}
      title={<span className="break-words">{order.brandName}</span>}
      line={
        <>
          <span className="font-mono font-bold text-white">{order.number}</span> ·{" "}
          {copy.myBrand.placedOn(formatDate(order.createdAt))}
        </>
      }
      aside={
        <div className="flex flex-col items-start gap-2">
          {paid ? <Badge variant={stage === "cancelled" ? "live" : "brand"}>{text.stageLabels[stage]}</Badge> : <OrderStatusBadge status={order.status} />}
          <p className="text-xs leading-normal text-forest-ink">{copy.myBrand.note.line}</p>
        </div>
      }
    />
    <div className="bg-cream pt-4 pb-19 sm:pt-6 md:pb-24">
    <div className="shell">
      <Link
        href="/my-brand"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-brand hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {text.back}
      </Link>

      <Card className="mt-2">
        {stage !== "cancelled" && order.status !== "cancelled" && order.status !== "returned" && (
          <Stepper
            label={text.timelineLabel}
            steps={[
              { label: text.timeline.confirmed, detail: order.paidAt ? formatDate(order.paidAt) : undefined },
              { label: text.timeline.production },
              { label: text.timeline.quality },
              { label: text.timeline.dispatch },
            ]}
            current={customerStepIndex(stage, paid)}
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
          {/* The team no longer sends proofs; orders that got one still show it. */}
          {paid && stages.proofs.length > 0 && (
            <Card as="section" aria-labelledby="brand-proof">
              <h2 id="brand-proof" className="text-h3 text-ink">
                {proofText.title}
              </h2>
              <p className="mt-1 text-body text-muted">{proofText.line}</p>
              <div className="mt-4">
                <ProofList orderId={order.id} proofs={stages.proofs} />
              </div>
              {decidable && latestProof && (
                <div className="mt-5 border-t border-line pt-5">
                  <ProofDecision orderId={order.id} proofId={latestProof.id} />
                </div>
              )}
            </Card>
          )}

          {shipment && (stage === "dispatched" || stage === "delivered") && (
            <Card as="section" aria-labelledby="brand-tracking">
              <h2 id="brand-tracking" className="text-h3 text-ink">
                {proofText.tracking}
              </h2>
              <p className="mt-2 text-body text-ink">{proofText.courier(shipment.courierName, shipment.awb)}</p>
            </Card>
          )}

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
                      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand hover:underline"
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

          <Card as="section" aria-labelledby="brand-labels">
            <h2 id="brand-labels" className="text-h3 text-ink">
              {text.labelsTitle}
            </h2>
            <p className="mt-1 mb-4 text-small text-muted">{text.labelsLine}</p>
            <OrderLabels items={order.items} empty={text.noLabel} />
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

          {paid && (
            <Card as="section" aria-labelledby="brand-history">
              <h2 id="brand-history" className="text-h3 text-ink">
                {proofText.history}
              </h2>
              <ol className="mt-3 flex flex-col gap-2 text-sm text-ink">
                {stages.stageEvents.map((event) => (
                  <li key={event.id}>
                    {proofText.historyLine(
                      text.stageLabels[event.toStage],
                      formatDateTime(event.createdAt),
                      proofText.actors[event.actorKind as keyof typeof proofText.actors] ?? proofText.actors.system,
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <OrderDocuments
            orderId={order.id}
            orderNumber={order.number}
            documents={documents}
            showUnpaidNote={unpaid}
          />
        </div>

        <OrderSummary
          totals={totals}
          items={order.items.map((item) => ({
            key: item.productSlug,
            name: item.productName,
            detail: copy.review.itemDetail(item.quantity, item.unitLabel ?? "", formatPaise(item.unitPaise)),
            totalPaise: item.lineTotalPaise,
          }))}
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
    </div>
    </>
  );
}
