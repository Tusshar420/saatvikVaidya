import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ActivityList } from "@/components/admin/activity-list";
import { AssistedStatusBadge, CustomerSummary } from "@/components/admin/assisted-order-bits";
import { CancelPanel, LinkPanel, PhonePanel } from "@/components/admin/assisted-order-panels";
import { DataTable, TBody, THead, Td, Th, Tr } from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { FormAlert } from "@/components/site/auth/form-alert";
import { OrderStatusBadge } from "@/components/site/orders/order-status-badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { admin as adminCopy } from "@/content/admin";
import { assistedOrders as copy } from "@/content/assisted-orders";
import { isAssistedOrderId, preparedOrderPath } from "@/lib/assisted-orders";
import { formatDateTime, formatNumber, formatPaise } from "@/lib/format";
import { readActivity } from "@/server/admin/audit";
import { readAssistedOrderForAdmin } from "@/server/assisted-orders/assisted-orders";
import { requireAdmin } from "@/server/auth/session";
import { siteLink } from "@/server/notify/compose";
import { saveCustomerAddressAction } from "../actions";

const text = copy.admin.detail;

export async function generateMetadata({ params }: PageProps<"/admin/assisted-orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  const order = isAssistedOrderId(id) ? await readAssistedOrderForAdmin(id) : null;
  return { title: order ? text.metaTitle(order.customer.name) : copy.admin.metaTitle };
}

const sentKeys = ["sms", "email", "both", "none"] as const;

/**
 * One order prepared for a customer: its items priced for them today, the
 * link to share, confirming it on a call with a code, and cancelling it.
 */
export default async function AssistedOrderPage({
  params,
  searchParams,
}: PageProps<"/admin/assisted-orders/[id]">) {
  const { id } = await params;
  if (!isAssistedOrderId(id)) notFound();
  await requireAdmin("orders", `/admin/assisted-orders/${id}`);
  const order = await readAssistedOrderForAdmin(id);
  if (!order) notFound();
  const activity = await readActivity({ resource: "AssistedOrder", resourceId: order.id, take: 10 });
  const sentParam = (await searchParams).sent;
  const sent = sentKeys.find((key) => key === sentParam) ?? null;
  const { lines, totals, hasIssues } = order.priced;
  const open = order.status === "open";

  return (
    <>
      <Link
        href="/admin/assisted-orders"
        className={buttonClasses({ variant: "link", className: "-ml-1 min-h-11 px-1" })}
      >
        <ChevronLeft aria-hidden className="size-4" />
        {text.back}
      </Link>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={text.title(order.customer.name)}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <AssistedStatusBadge status={order.status} />
            <span>
              {text.preparedOn(order.preparedBy ?? copy.admin.unknownStaff, formatDateTime(order.createdAt))}
            </span>
            {open && <span>{text.expiresOn(formatDateTime(order.expiresAt))}</span>}
          </span>
        }
        className="mt-2"
      />

      {sent && open && (
        <FormAlert tone={sent === "none" ? "error" : "success"} className="mt-5">
          {sent === "none" ? text.sentNowhere : text.sentBy(text.channels[sent])}
        </FormAlert>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {order.status === "placed" && order.order && (
            <Card as="section" aria-labelledby="assisted-placed">
              <h2 id="assisted-placed" className="text-h3 text-ink">
                {text.placedTitle}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {text.placedLine(order.placedBy ?? "customer", formatDateTime(order.placedAt ?? order.createdAt))}
              </p>
              <p className="mt-3 flex flex-wrap items-center gap-3">
                <span className="font-mono font-bold text-ink">{order.order.number}</span>
                <OrderStatusBadge status={order.order.status} labels={adminCopy.orders.statuses} />
                <Link
                  href={`/admin/orders/${order.order.id}`}
                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                >
                  {text.openOrder}
                </Link>
              </p>
            </Card>
          )}
          {order.status === "cancelled" && <FormAlert>{text.cancelledLine}</FormAlert>}
          {order.status === "expired" && <FormAlert>{text.expiredLine}</FormAlert>}

          {open && (
            <>
              <Card as="section" aria-labelledby="assisted-link-title">
                <h2 id="assisted-link-title" className="text-h3 text-ink">
                  {text.linkTitle}
                </h2>
                <p className="mt-1 mb-4 text-sm text-muted">{text.linkLine}</p>
                <LinkPanel
                  id={order.id}
                  link={siteLink(preparedOrderPath(order.id))}
                  customerName={order.customer.name}
                  phoneNumber={order.customer.phoneNumber}
                />
              </Card>

              <Card as="section" aria-labelledby="assisted-phone-title">
                <h2 id="assisted-phone-title" className="text-h3 text-ink">
                  {text.phoneTitle}
                </h2>
                <p className="mt-1 mb-4 text-sm text-muted">{text.phoneLine}</p>
                <PhonePanel
                  id={order.id}
                  addresses={order.addresses}
                  expectedTotalPaise={totals.totalPaise}
                  codeLive={order.codeLive}
                  canPlace={!hasIssues}
                  canReach={order.canReach}
                  saveAddress={saveCustomerAddressAction.bind(null, order.id)}
                />
              </Card>
            </>
          )}

          <section aria-labelledby="assisted-items">
            <h2 id="assisted-items" className="text-h3 text-ink">
              {text.itemsTitle}
            </h2>
            <DataTable caption={text.itemsCaption} className="mt-3">
              <THead>
                <Th>{text.columns.product}</Th>
                <Th>{text.columns.unit}</Th>
                <Th>{text.columns.quantity}</Th>
                <Th className="text-right">{text.columns.total}</Th>
              </THead>
              <TBody>
                {lines.map((line) => (
                  <Tr key={line.productId}>
                    <Td>
                      <span className="block font-bold text-ink">{line.name}</span>
                      <span className="block text-small text-muted">{line.packSize}</span>
                      {line.issue && open && (
                        <span className="mt-1 block text-small font-bold text-danger">{text.unavailable}</span>
                      )}
                    </Td>
                    <Td label={text.columns.unit} className="whitespace-nowrap">
                      {formatPaise(line.unitPaise)}
                    </Td>
                    <Td label={text.columns.quantity}>{formatNumber(line.quantity)}</Td>
                    <Td label={text.columns.total} className="font-bold whitespace-nowrap text-ink md:text-right">
                      {formatPaise(line.lineTotalPaise)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </DataTable>
            {open && (
              <>
                <dl className="mt-4 ml-auto flex max-w-sm flex-col gap-1.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">{text.totals.subtotal}</dt>
                    <dd className="text-ink">{formatPaise(totals.subtotalPaise)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">{text.totals.delivery}</dt>
                    <dd className="text-ink">
                      {totals.shippingPaise === 0 ? text.totals.free : formatPaise(totals.shippingPaise)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-line pt-1.5 font-extrabold">
                    <dt className="text-ink">{text.totals.total}</dt>
                    <dd className="text-ink">{formatPaise(totals.totalPaise)}</dd>
                  </div>
                </dl>
                <p className="mt-2 ml-auto max-w-sm text-small text-muted">{text.totals.note}</p>
              </>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card as="section" aria-labelledby="assisted-customer">
            <h2 id="assisted-customer" className="text-h3 text-ink">
              {text.customerTitle}
            </h2>
            <CustomerSummary customer={order.customer} className="mt-3" />
          </Card>

          {order.note && (
            <Card as="section" aria-labelledby="assisted-note">
              <h2 id="assisted-note" className="text-h3 text-ink">
                {text.noteTitle}
              </h2>
              <p className="mt-2 text-sm whitespace-pre-line text-ink">{order.note}</p>
            </Card>
          )}

          {open && (
            <Card as="section" aria-labelledby="assisted-cancel">
              <h2 id="assisted-cancel" className="text-h3 text-ink">
                {text.cancelTitle}
              </h2>
              <div className="mt-2">
                <CancelPanel id={order.id} />
              </div>
            </Card>
          )}

          <Card as="section" aria-labelledby="assisted-activity">
            <h2 id="assisted-activity" className="text-h3 text-ink">
              {text.activityTitle}
            </h2>
            <ActivityList items={activity} empty={text.activityEmpty} />
          </Card>
        </div>
      </div>
    </>
  );
}
