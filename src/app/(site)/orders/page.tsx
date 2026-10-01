import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { OrderStatusBadge } from "@/components/site/orders/order-status-badge";
import { Eyebrow } from "@/components/ui/badge";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { orders as copy } from "@/content/orders";
import { formatDate, formatPaise } from "@/lib/format";
import { checkoutPathFor } from "@/lib/orders";
import { requireUser } from "@/server/auth/session";
import { listOrdersForUser } from "@/server/orders/history";

const text = copy.list;

export const metadata: Metadata = {
  title: text.metaTitle,
  robots: { index: false, follow: false },
};

function pageOf(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 && page <= 10_000 ? page : 1;
}

/** The signed-in buyer's orders, newest first. */
export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const { user } = await requireUser("/orders");
  const { orders, page, pageCount } = await listOrdersForUser(user.id, pageOf((await searchParams).page));
  const pageHref = (target: number) => (target > 1 ? `/orders?page=${target}` : "/orders");

  return (
    <div className="shell section-y">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>{text.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-h2 text-ink">
          {text.title} <em className="block text-teal not-italic">{text.titleEmphasis}</em>
        </h1>

        {orders.length === 0 ? (
          <EmptyState
            as="h2"
            icon={<Package aria-hidden />}
            title={text.emptyTitle}
            description={text.emptyLine}
            className="mt-8"
            action={
              <Link href="/products" className={buttonClasses()}>
                {text.shop}
                <ButtonArrow />
              </Link>
            }
          />
        ) : (
          <ul aria-label={text.listLabel} className="mt-8 flex flex-col gap-4">
            {orders.map((order) => {
              const unpaid = order.status === "pending_payment" || order.status === "payment_failed";
              return (
                <li
                  key={order.id}
                  className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <h2 className="font-mono text-lg font-extrabold text-ink">{order.number}</h2>
                      <p className="text-small text-muted">
                        {text.placedOn(formatDate(order.createdAt))} · {text.items(order.itemCount)}
                      </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="mt-3 text-sm break-words text-ink">
                    {order.names.join(", ")}
                    {order.itemCount > order.names.length ? "…" : ""}
                  </p>
                  {order.shipmentStatus &&
                    order.status !== "cancelled" &&
                    order.status !== "delivered" && (
                      <p className="mt-1 text-small font-semibold text-teal">
                        {copy.shipmentStatus[order.shipmentStatus]}
                      </p>
                    )}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                    <p className="text-lg font-extrabold text-ink">{formatPaise(order.totalPaise)}</p>
                    <div className="flex flex-wrap gap-2 max-sm:w-full max-sm:*:flex-1">
                      {unpaid && (
                        <Link
                          href={checkoutPathFor(order.id, order.status)}
                          className={buttonClasses({ size: "sm" })}
                        >
                          {text.payNow}
                        </Link>
                      )}
                      <Link
                        href={`/orders/${order.id}`}
                        aria-label={text.viewLabel(order.number)}
                        className={buttonClasses({ variant: "secondary", size: "sm" })}
                      >
                        {text.view}
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {pageCount > 1 && (
          <nav
            aria-label={text.page(page, pageCount)}
            className="mt-6 flex items-center justify-between gap-3"
          >
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                <ChevronLeft aria-hidden className="size-4" />
                {text.previous}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-small text-muted">{text.page(page, pageCount)}</span>
            {page < pageCount ? (
              <Link href={pageHref(page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                {text.next}
                <ChevronRight aria-hidden className="size-4" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
