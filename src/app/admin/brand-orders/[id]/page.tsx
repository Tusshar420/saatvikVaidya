import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { VerificationBadge } from "@/components/admin/badges";
import { BrandProductionPanel } from "@/components/admin/brand-production-panel";
import { BrandProofUpload } from "@/components/admin/brand-proof-upload";
import { CancelOrder } from "@/components/admin/cancel-order";
import { AdminPageHeader } from "@/components/admin/page-header";
import { LogoPreview } from "@/components/site/brand/logo-preview";
import { ProofList } from "@/components/site/brand/proof-list";
import { OrderDocuments } from "@/components/site/orders/order-documents";
import { OrderStatusBadge } from "@/components/site/orders/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { admin as adminCopy } from "@/content/admin";
import { brand as copy } from "@/content/brand";
import { addressLines } from "@/lib/address";
import { isImageLogo } from "@/lib/brand";
import { canUploadProof, nextProductionStage } from "@/lib/brand-stage";
import { formatDateTime, formatPaise } from "@/lib/format";
import { isOrderId } from "@/lib/orders";
import { formatIndianPhone } from "@/lib/phone";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { requireAdmin } from "@/server/auth/session";
import { canCancelOrder } from "@/server/admin/orders";
import { readBrandOrderForAdmin } from "@/server/brand/orders";
import { readBrandStages } from "@/server/brand/stages";
import { readOrderDocuments } from "@/server/invoices/invoices";

const text = copy.admin.detail;
const detailText = copy.detail;

export const metadata: Metadata = { title: copy.admin.metaTitle };

const paymentVariant = { created: "orange", succeeded: "teal", failed: "live" } as const;

/**
 * One brand order (P2.1): the logo (view and download), what goes on the
 * label, the product and quantity, payment, and the customer's contact (P2.1);
 * and the label proofs, production steps, stage history and cancelling (P2.2).
 */
export default async function AdminBrandOrderPage({ params }: PageProps<"/admin/brand-orders/[id]">) {
  const { id } = await params;
  if (!isOrderId(id)) notFound();
  await requireAdmin("orders", `/admin/brand-orders/${id}`);
  const order = await readBrandOrderForAdmin(id);
  if (!order) notFound();
  const [documents, stages] = await Promise.all([readOrderDocuments(order), readBrandStages(order.id)]);
  if (!stages) notFound();
  const stage = stages.stage;
  const paid = order.status !== "pending_payment" && order.status !== "payment_failed" && order.paidAt !== null;
  const nextStep = paid ? nextProductionStage(stage) : null;
  const details = order.details;
  const logoSrc = `/api/brand-orders/${order.id}/logo`;
  const unitLabel = order.unitLabel ?? "";
  const rows: [string, string | null][] = details
    ? [
        [detailText.brandName, details.brandName],
        [detailText.tagline, details.tagline],
        [detailText.marketedBy, [details.marketedByName, details.marketedByAddress].filter(Boolean).join(", ") || null],
        [detailText.contactPhone, details.contactPhone],
        [detailText.notes, details.notes],
      ]
    : [];
  const user = order.user;

  return (
    <>
      <Link
        href="/admin/brand-orders"
        className={buttonClasses({ variant: "link", className: "-ml-1 min-h-11 px-1" })}
      >
        <ChevronLeft aria-hidden className="size-4" />
        {text.back}
      </Link>
      <AdminPageHeader
        eyebrow={copy.admin.eyebrow}
        title={<span className="break-words">{order.brandName}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono font-bold text-ink">{order.number}</span>
            <OrderStatusBadge status={order.status} labels={adminCopy.orders.statuses} />
            {paid && <Badge variant={stage === "cancelled" ? "live" : "teal"}>{detailText.stageLabels[stage]}</Badge>}
            <span>{formatDateTime(order.createdAt)}</span>
          </span>
        }
        className="mt-2"
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <Card as="section" aria-labelledby="brand-packaging">
            <h2 id="brand-packaging" className="text-h3 text-ink">
              {text.packaging}
            </h2>
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

          <Card as="section" aria-labelledby="brand-product">
            <h2 id="brand-product" className="text-h3 text-ink">
              {text.product}
            </h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-small font-bold text-muted">{text.product}</dt>
                <dd className="font-bold text-ink">{order.productName}</dd>
                <dd className="text-small text-muted">{order.packSize}</dd>
              </div>
              <div>
                <dt className="text-small font-bold text-muted">{text.quantity}</dt>
                <dd className="text-ink">{copy.admin.units(order.quantity, unitLabel)}</dd>
              </div>
              <div>
                <dt className="text-small font-bold text-muted">{text.unitPrice}</dt>
                <dd className="text-ink">{formatPaise(order.unitPaise)}</dd>
              </div>
              <div>
                <dt className="text-small font-bold text-muted">{text.total}</dt>
                <dd className="text-lg font-extrabold text-ink">{formatPaise(order.totalPaise)}</dd>
                <dd className="text-small text-muted">
                  {adminCopy.orderDetail.totals.tax}: {formatPaise(order.taxPaise)} ·{" "}
                  {adminCopy.orderDetail.totals.shipping}:{" "}
                  {order.shippingPaise === 0 ? adminCopy.orderDetail.totals.free : formatPaise(order.shippingPaise)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card as="section" aria-labelledby="brand-proofs">
            <h2 id="brand-proofs" className="text-h3 text-ink">
              {text.proofs}
            </h2>
            <p className="mt-1 text-sm text-muted">{text.proofsLine}</p>
            {stages.proofs.length === 0 ? (
              <p className="mt-4 text-sm text-muted">{text.noProofs}</p>
            ) : (
              <div className="mt-4">
                <ProofList orderId={order.id} proofs={stages.proofs} commentLabel={text.customerComment} />
              </div>
            )}
            {paid && (canUploadProof(stage) || stage === "proof_sent") ? (
              <div className="mt-5 border-t border-line pt-5">
                <h3 className="text-base font-extrabold text-ink">{text.uploadTitle}</h3>
                {stage === "proof_sent" && <p className="mt-1 text-sm text-muted">{text.replaceLine}</p>}
                <div className="mt-3">
                  <BrandProofUpload orderId={order.id} />
                </div>
              </div>
            ) : (
              paid && <p className="mt-4 text-sm text-muted">{text.uploadClosed}</p>
            )}
          </Card>

          <Card as="section" aria-labelledby="brand-production">
            <h2 id="brand-production" className="text-h3 text-ink">
              {text.production}
            </h2>
            <div className="mt-3 flex flex-col gap-3 text-sm">
              {stage === "cancelled" ? (
                <p className="text-muted">{text.cancelled}</p>
              ) : stage === "delivered" ? (
                <p className="text-muted">{text.finished}</p>
              ) : !paid ? (
                <p className="text-muted">{text.results.not_paid}</p>
              ) : nextStep ? (
                <>
                  <p className="text-muted">{text.productionLine}</p>
                  <BrandProductionPanel orderId={order.id} stage={stage} next={nextStep as "in_production" | "quality_check" | "dispatched" | "delivered"} />
                </>
              ) : (
                <p className="text-muted">{stage === "proof_sent" ? text.waiting : text.needProof}</p>
              )}
              {stages.order.shipment && (
                <p className="text-ink">
                  <span className="font-bold">{text.tracking}: </span>
                  {copy.proof.courier(stages.order.shipment.courierName, stages.order.shipment.awb)}
                </p>
              )}
            </div>
          </Card>

          <Card as="section" aria-labelledby="brand-history">
            <h2 id="brand-history" className="text-h3 text-ink">
              {text.history}
            </h2>
            <ol className="mt-3 flex flex-col gap-2 text-sm text-ink">
              {stages.stageEvents.map((event) => (
                <li key={event.id} className="break-words">
                  {copy.proof.historyLine(
                    detailText.stageLabels[event.toStage],
                    formatDateTime(event.createdAt),
                    copy.proof.actors[event.actorKind as keyof typeof copy.proof.actors] ?? copy.proof.actors.system,
                  )}
                  {event.note ? ` · ${event.note}` : ""}
                </li>
              ))}
            </ol>
          </Card>

          <Card as="section" aria-labelledby="brand-cancel">
            <h2 id="brand-cancel" className="text-h3 text-ink">
              {text.cancelTitle}
            </h2>
            <div className="mt-3">
              <CancelOrder
                orderId={order.id}
                number={order.number}
                allowed={canCancelOrder({ status: order.status, shipment: null, brandStage: stage })}
                restock={false}
                brand
              />
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card as="section" aria-labelledby="brand-customer">
            <h2 id="brand-customer" className="text-h3 text-ink">
              {text.customer}
            </h2>
            {user ? (
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                <div>
                  <dt className="sr-only">{text.customer}</dt>
                  <dd>
                    <Link href={`/admin/users/${user.id}`} className="font-bold break-words text-teal hover:underline">
                      {user.name}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-small font-bold text-muted">{text.userType}</dt>
                  <dd className="flex flex-wrap items-center gap-2 text-ink">
                    {user.userType.label}
                    {user.userType.isProfessional && <VerificationBadge status={user.verificationStatus} />}
                  </dd>
                </div>
                {!isPlaceholderEmail(user.email) && (
                  <div>
                    <dt className="text-small font-bold text-muted">{text.email}</dt>
                    <dd>
                      <a href={`mailto:${user.email}`} className="break-all text-teal hover:underline">
                        {user.email}
                      </a>
                    </dd>
                  </div>
                )}
                {user.phoneNumber && (
                  <div>
                    <dt className="text-small font-bold text-muted">{text.phone}</dt>
                    <dd>
                      <a href={`tel:${user.phoneNumber}`} className="text-teal hover:underline">
                        {formatIndianPhone(user.phoneNumber)}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted">{text.deletedUser}</p>
            )}
          </Card>

          <Card as="section" aria-labelledby="brand-address">
            <h2 id="brand-address" className="text-h3 text-ink">
              {text.deliverTo}
            </h2>
            <address className="mt-3 text-sm text-ink not-italic">
              <span className="block font-extrabold">{order.address.name}</span>
              {addressLines(order.address).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              <a href={`tel:${order.address.phone}`} className="mt-1 block text-teal hover:underline">
                {formatIndianPhone(order.address.phone)}
              </a>
            </address>
          </Card>

          <Card as="section" aria-labelledby="brand-payment">
            <h2 id="brand-payment" className="text-h3 text-ink">
              {text.payment}
            </h2>
            {order.payment ? (
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink">
                <Badge variant={paymentVariant[order.payment.status]}>
                  {adminCopy.orderDetail.paymentStatus[order.payment.status]}
                </Badge>
                <span className="text-muted">
                  {order.payment.provider} · {text.attempt(order.payment.attempt)}
                </span>
                {stages.refund && <span className="text-muted">{text.refund(stages.refund)}</span>}
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">{detailText.none}</p>
            )}
          </Card>

          <OrderDocuments
            orderId={order.id}
            orderNumber={order.number}
            documents={documents}
            showUnpaidNote={false}
          />
        </div>
      </div>
    </>
  );
}
