import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ActivityList } from "@/components/admin/activity-list";
import { CancelOrder } from "@/components/admin/cancel-order";
import {
  DataTable,
  TBody,
  THead,
  Td,
  Th,
  Tr,
} from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ShipmentPanel } from "@/components/admin/shipment-panel";
import { OrderDocuments } from "@/components/site/orders/order-documents";
import { OrderStatusBadge } from "@/components/site/orders/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ComingSoon } from "@/components/ui/empty-state";
import { admin as copy } from "@/content/admin";
import { orders as ordersCopy } from "@/content/orders";
import { addressLines } from "@/lib/address";
import { formatDateTime, formatNumber, formatPaise } from "@/lib/format";
import { isOrderId } from "@/lib/orders";
import { formatIndianPhone } from "@/lib/phone";
import { readActivity } from "@/server/admin/audit";
import { canCancelOrder, readAdminOrder } from "@/server/admin/orders";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { requireAdmin } from "@/server/auth/session";
import { readOrderDocuments } from "@/server/invoices/invoices";
import { shippingAvailable } from "@/server/shipping";

const text = copy.orderDetail;

export async function generateMetadata({
  params,
}: PageProps<"/admin/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  const order = isOrderId(id) ? await readAdminOrder(id) : null;
  return { title: order ? text.metaTitle(order.number) : copy.orders.metaTitle };
}

const paymentVariant = { created: "orange", succeeded: "teal", failed: "live" } as const;

/** One order: items, totals, customer, payments, the shipment and cancelling. */
export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  if (!isOrderId(id)) notFound();
  await requireAdmin("orders", `/admin/orders/${id}`);
  const order = await readAdminOrder(id);
  if (!order) notFound();
  const [activity, shippingOn, documents] = await Promise.all([
    readActivity({ resource: "Order", resourceId: order.id, take: 10 }),
    Promise.resolve(shippingAvailable()),
    readOrderDocuments(order),
  ]);
  const address = {
    name: order.shipName,
    phone: order.shipPhone,
    line1: order.shipLine1,
    line2: order.shipLine2,
    landmark: order.shipLandmark,
    city: order.shipCity,
    state: order.shipState,
    pincode: order.shipPincode,
  };
  const shipment = order.shipment;
  const closed = ["cancelled", "pending_payment", "payment_failed"].includes(order.status);

  return (
    <>
      <Link
        href="/admin/orders"
        className={buttonClasses({ variant: "link", className: "-ml-1 min-h-11 px-1" })}
      >
        <ChevronLeft aria-hidden className="size-4" />
        {text.back}
      </Link>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={<span className="font-mono">{order.number}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <OrderStatusBadge status={order.status} labels={copy.orders.statuses} />
            <span>{text.placedOn(formatDateTime(order.createdAt))}</span>
          </span>
        }
        className="mt-2"
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <Card as="section" aria-labelledby="order-shipment">
            <h2 id="order-shipment" className="text-h3 text-ink">
              {text.shipmentTitle}
            </h2>
            <div className="mt-4">
              {!shipment && order.items.every((item) => item.kind === "ebook") ? (
                <p className="text-sm text-muted">{text.nothingToShip}</p>
              ) : !shippingOn && !shipment ? (
                <ComingSoon as="h3" title={text.shippingOff} />
              ) : closed && !shipment ? (
                <p className="text-sm text-muted">{text.shipmentClosed}</p>
              ) : (
                <ShipmentPanel
                  orderId={order.id}
                  canCreate={order.status === "paid"}
                  shipment={
                    shipment
                      ? { status: shipment.status, courierName: shipment.courierName, awb: shipment.awb }
                      : null
                  }
                />
              )}
            </div>
            {shipment && shipment.events.length > 0 && (
              <section aria-labelledby="order-events" className="mt-5 border-t border-line pt-4">
                <h3 id="order-events" className="text-label text-muted uppercase">
                  {text.eventsTitle}
                </h3>
                <ol aria-label={text.eventsLabel} className="mt-3 flex flex-col gap-2.5">
                  {shipment.events.map((event) => (
                    <li key={event.id} className="flex flex-col text-sm sm:flex-row sm:gap-3">
                      <span className="font-semibold text-ink sm:w-48 sm:shrink-0">
                        {ordersCopy.shipmentStatus[event.status]}
                      </span>
                      <span className="text-small text-muted">
                        {formatDateTime(event.createdAt)}
                        {event.location ? ` · ${event.location}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </Card>

          <section aria-labelledby="order-items">
            <h2 id="order-items" className="text-h3 text-ink">
              {text.itemsTitle}
            </h2>
            <DataTable caption={text.itemsCaption} className="mt-3">
              <THead>
                <Th>{text.columns.product}</Th>
                <Th>{text.columns.unit}</Th>
                <Th>{text.columns.quantity}</Th>
                <Th>{text.columns.gst}</Th>
                <Th className="text-right">{text.columns.total}</Th>
              </THead>
              <TBody>
                {order.items.map((item) => (
                  <Tr key={item.id}>
                    <Td>
                      <span className="block font-bold text-ink">{item.productName}</span>
                      <span className="block text-small text-muted">
                        {item.packSize} · HSN {item.hsnCode}
                      </span>
                    </Td>
                    <Td label={text.columns.unit} className="whitespace-nowrap">
                      {formatPaise(item.unitPaise)}{" "}
                      <span className="text-small text-muted">({text.tier[item.priceTier] ?? item.priceTier})</span>
                    </Td>
                    <Td label={text.columns.quantity}>{formatNumber(item.quantity)}</Td>
                    <Td label={text.columns.gst} className="whitespace-nowrap">
                      {item.gstRate}% · {formatPaise(item.taxPaise)}
                    </Td>
                    <Td label={text.columns.total} className="font-bold whitespace-nowrap text-ink md:text-right">
                      {formatPaise(item.lineTotalPaise)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </DataTable>
            <dl className="mt-4 ml-auto flex max-w-sm flex-col gap-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{text.totals.subtotal}</dt>
                <dd className="text-ink">{formatPaise(order.subtotalPaise)}</dd>
              </div>
              {order.coinDiscountPaise > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{text.totals.coins(order.coinsRedeemed)}</dt>
                  <dd className="text-green">−{formatPaise(order.coinDiscountPaise)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{text.totals.tax}</dt>
                <dd className="text-ink">{formatPaise(order.taxPaise)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{text.totals.shipping}</dt>
                <dd className="text-ink">
                  {order.shippingPaise === 0 ? text.totals.free : formatPaise(order.shippingPaise)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-2">
                <dt className="font-bold text-ink">{text.totals.total}</dt>
                <dd className="text-lg font-extrabold text-ink">{formatPaise(order.totalPaise)}</dd>
              </div>
            </dl>
          </section>

          <Card as="section" aria-labelledby="order-payments">
            <h2 id="order-payments" className="text-h3 text-ink">
              {text.paymentsTitle}
            </h2>
            {order.payments.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{text.paymentsEmpty}</p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-line">
                {order.payments.map((payment) => (
                  <li key={payment.id} className="flex flex-col gap-1 py-3 text-sm first:pt-0 last:pb-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">
                        {text.payment(payment.attempt, payment.provider)}
                      </span>
                      <Badge variant={paymentVariant[payment.status]}>
                        {text.paymentStatus[payment.status]}
                      </Badge>
                    </span>
                    <span className="text-small text-muted">
                      {formatPaise(payment.amountPaise)} ·{" "}
                      <span className="break-all">{payment.reference}</span> ·{" "}
                      <span className="whitespace-nowrap">
                        {formatDateTime(payment.completedAt ?? payment.createdAt)}
                      </span>
                    </span>
                    {payment.failureReason && (
                      <span className="text-small text-muted">{text.failureReason(payment.failureReason)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card as="section" aria-labelledby="order-customer">
            <h2 id="order-customer" className="text-h3 text-ink">
              {text.customerTitle}
            </h2>
            {order.user ? (
              <div className="mt-3 flex flex-col gap-1 text-sm">
                <span className="font-bold break-words text-ink">{order.user.name}</span>
                {!isPlaceholderEmail(order.user.email) && (
                  <span className="break-all text-muted">{order.user.email}</span>
                )}
                {order.user.phoneNumber && (
                  <span className="text-muted">{formatIndianPhone(order.user.phoneNumber)}</span>
                )}
                <Link
                  href={`/admin/users/${order.user.id}`}
                  className={buttonClasses({ variant: "link", className: "mt-1 min-h-11 self-start px-0" })}
                >
                  {text.viewUser}
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">{text.deletedAccount}</p>
            )}
          </Card>

          <Card as="section" aria-labelledby="order-address">
            <h2 id="order-address" className="text-h3 text-ink">
              {text.addressTitle}
            </h2>
            <p className="mt-3 text-sm text-ink">
              <span className="block font-bold">{address.name}</span>
              {addressLines(address).map((line) => (
                <span key={line} className="block break-words">
                  {line}
                </span>
              ))}
              <span className="block text-muted">{formatIndianPhone(address.phone)}</span>
            </p>
          </Card>

          <OrderDocuments
            orderId={order.id}
            orderNumber={order.number}
            documents={documents}
            showUnpaidNote={order.status === "pending_payment" || order.status === "payment_failed"}
          />

          <Card as="section" aria-labelledby="order-cancel">
            <h2 id="order-cancel" className="text-h3 text-ink">
              {text.cancelTitle}
            </h2>
            <div className="mt-3">
              <CancelOrder
                orderId={order.id}
                number={order.number}
                allowed={canCancelOrder(order)}
                restock={order.status === "paid" || order.status === "processing"}
              />
            </div>
          </Card>

          <Card as="section" aria-labelledby="order-activity">
            <h2 id="order-activity" className="text-h3 text-ink">
              {text.activityTitle}
            </h2>
            <ActivityList items={activity} empty={text.activityEmpty} />
          </Card>
        </div>
      </div>
    </>
  );
}
