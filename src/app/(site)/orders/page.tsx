import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { ProductVisual } from "@/components/site/catalogue/product-visual";
import { BuyAgainButton } from "@/components/site/orders/buy-again-button";
import { GuestOrders } from "@/components/site/orders/guest-orders";
import { Eyebrow } from "@/components/ui/badge";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HScroller } from "@/components/ui/hscroller";
import { orders as copy } from "@/content/orders";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { ORDER_RANGES, ordersHref, parseOrderRange, type OrderRange } from "@/lib/order-ranges";
import { getSession } from "@/server/auth/session";
import { listBuyAgainForUser, listOrdersForUser, type BuyAgainItem, type OrderListItem } from "@/server/orders/history";

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

/**
 * The signed-in buyer's orders, laid out like a big store's: products to
 * buy again on top, then a compact purchase history (name, status and date;
 * the order page has the rest), filtered by period.
 */
export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const session = await getSession();
  if (!session) return <GuestOrders />;
  const { user } = session;
  const params = await searchParams;
  const range = parseOrderRange(params.range);
  const [{ orders, page, pageCount, total }, buyAgain] = await Promise.all([
    listOrdersForUser(user.id, pageOf(params.page), range),
    listBuyAgainForUser(user.id),
  ]);
  const noOrdersAtAll = total === 0 && range === "all";

  return (
    <div className="shell py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>{text.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-h3 text-ink">{text.title}</h1>

        {noOrdersAtAll ? (
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
          <>
            {buyAgain.length > 0 && <BuyAgain items={buyAgain} />}

            <section aria-labelledby="order-history-title" className="mt-8">
              <h2 id="order-history-title" className="font-heading text-h4 text-ink">
                {text.historyTitle}
              </h2>
              <RangeFilter current={range} />

              {orders.length === 0 ? (
                <EmptyState
                  as="h3"
                  icon={<Package aria-hidden />}
                  title={text.rangeEmptyTitle}
                  description={text.rangeEmptyLine}
                  className="mt-4"
                  action={
                    <Link href="/orders" className={buttonClasses({ variant: "secondary" })}>
                      {text.showAll}
                    </Link>
                  }
                />
              ) : (
                <ul aria-label={text.listLabel} className="mt-4 flex flex-col gap-2.5">
                  {orders.map((order) => (
                    <OrderRow key={order.id} order={order} />
                  ))}
                </ul>
              )}
            </section>

            {pageCount > 1 && <Pagination range={range} page={page} pageCount={pageCount} />}
          </>
        )}
      </div>
    </div>
  );
}

/** Products from past orders, each with a one-tap "Add to cart". */
function BuyAgain({ items }: { items: BuyAgainItem[] }) {
  const buy = copy.buyAgain;
  return (
    <section aria-labelledby="buy-again-title" className="mt-6">
      <h2 id="buy-again-title" className="font-heading text-h4 text-ink">
        {buy.title}
      </h2>
      <p className="text-small text-muted">{buy.lead}</p>
      <HScroller label={buy.label} className="mt-3" itemClassName="w-[42vw] max-w-44 sm:w-44">
        {items.map((item) => (
          <article
            key={item.productId}
            className="flex h-full flex-col gap-2 rounded-lg border border-line bg-surface p-2.5 shadow-card"
          >
            <Link
              href={`/products/${item.slug}`}
              className="group flex flex-1 flex-col gap-2 focus-visible:outline-offset-2"
            >
              <span className="block aspect-square overflow-hidden rounded-md bg-cream">
                <ProductVisual image={item.image} glyph={item.glyph} className="text-4xl" />
              </span>
              <span className="line-clamp-2 text-small font-bold text-ink group-hover:text-brand group-hover:underline">
                {item.name}
              </span>
              <span className="mt-auto text-[11px] text-muted">{buy.packSize(item.packSize)}</span>
            </Link>
            <BuyAgainButton
              productId={item.productId}
              name={item.name}
              moq={item.moq}
              outOfStock={item.outOfStock}
            />
          </article>
        ))}
      </HScroller>
    </section>
  );
}

/** "All orders · This month · Last 3 months · This year · Last year", as links. */
function RangeFilter({ current }: { current: OrderRange }) {
  return (
    <nav aria-label={text.rangesLabel} className="mt-3">
      <ul className="-mx-1 flex scrollbar-none gap-2 overflow-x-auto px-1 py-1">
        {ORDER_RANGES.map((range) => {
          const active = range === current;
          return (
            <li key={range} className="shrink-0">
              <Link
                href={ordersHref(range)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-md border px-3.5 text-small font-bold whitespace-nowrap transition",
                  active
                    ? "border-orange bg-orange-soft font-extrabold text-orange-ink"
                    : "border-line bg-surface text-ink hover:border-brand/60",
                )}
              >
                {text.ranges[range]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** One order as a compact row: the whole row opens the order page. */
function OrderRow({ order }: { order: OrderListItem }) {
  const first = order.names[0] ?? order.number;
  const needsPayment = order.status === "pending_payment" || order.status === "payment_failed";
  return (
    <li>
      <Link
        href={`/orders/${order.id}`}
        className="group flex items-center gap-3 rounded-lg border border-line bg-surface p-2.5 shadow-card transition hover:border-brand/60 sm:gap-4 sm:p-3"
      >
        <span className="size-16 shrink-0 overflow-hidden rounded-md bg-cream sm:size-18">
          <ProductVisual image={order.image} glyph={order.glyph} className="text-2xl" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="sr-only">{text.orderLabel(order.number)}</span>
          <span className="truncate font-heading text-base font-extrabold text-ink group-hover:text-brand">
            {text.name(first, order.itemCount - 1)}
          </span>
          <span className="text-small text-muted">
            <span className={cn("font-bold", needsPayment ? "text-orange-ink" : "text-ink")}>
              {copy.status[order.status]}
            </span>
            {" · "}
            {text.placedOn(formatDate(order.createdAt))}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted group-hover:text-brand" />
      </Link>
    </li>
  );
}

function Pagination({ range, page, pageCount }: { range: OrderRange; page: number; pageCount: number }) {
  return (
    <nav aria-label={text.page(page, pageCount)} className="mt-6 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={ordersHref(range, page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          <ChevronLeft aria-hidden className="size-4" />
          {text.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-small text-muted">{text.page(page, pageCount)}</span>
      {page < pageCount ? (
        <Link href={ordersHref(range, page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          {text.next}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
