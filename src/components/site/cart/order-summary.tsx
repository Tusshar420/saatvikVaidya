import type { ReactNode } from "react";
import { cart as copy } from "@/content/cart";
import { coins as coinCopy } from "@/content/coins";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import type { OrderTotals } from "@/server/checkout/totals";

const text = copy.summary;

export type SummaryItem = { key: string | number; name: string; detail: string; totalPaise: number };

export type OrderSummaryProps = {
  totals: Pick<
    OrderTotals,
    "subtotalPaise" | "gst" | "shippingPaise" | "totalPaise"
  > &
    Partial<Pick<OrderTotals, "coinDiscountPaise">> &
    Partial<Pick<OrderTotals, "freeFromPaise" | "toFreeShippingPaise">>;
  /** Lines to list above the totals (checkout and confirmation). */
  items?: SummaryItem[];
  itemsLabel?: string;
  title?: string;
  /** Hide the "checked again at checkout" note (on placed orders). */
  hideNote?: boolean;
  /** Buttons and notes under the totals. */
  children?: ReactNode;
  className?: string;
};

/**
 * Items total, the GST inside it by rate, delivery and the total. Prices
 * include GST, so the GST rows are "includes", not added on top.
 */
export function OrderSummary({
  totals,
  items,
  itemsLabel,
  title = text.title,
  hideNote = false,
  children,
  className,
}: OrderSummaryProps) {
  return (
    <section
      aria-labelledby="order-summary-title"
      className={cn("rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6", className)}
    >
      <h2 id="order-summary-title" className="text-h3 text-ink">
        {title}
      </h2>

      {items && items.length > 0 && (
        <ul aria-label={itemsLabel} className="mt-4 flex flex-col divide-y divide-line border-b border-line">
          {items.map((item) => (
            <li key={item.key} className="flex justify-between gap-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{item.name}</span>
                <span className="text-small text-muted">{item.detail}</span>
              </span>
              <span className="shrink-0 font-bold text-ink">{formatPaise(item.totalPaise)}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-4 flex flex-col gap-2.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{text.subtotal}</dt>
          <dd className="font-semibold text-ink">{formatPaise(totals.subtotalPaise)}</dd>
        </div>
        {totals.gst.map((group) => (
          <div key={group.rate} className="flex justify-between gap-4 text-small text-muted">
            <dt className="pl-3">{text.gstAt(group.rate)}</dt>
            <dd>{formatPaise(group.taxPaise)}</dd>
          </div>
        ))}
        {totals.coinDiscountPaise ? (
          <div className="flex justify-between gap-4 text-success">
            <dt>{coinCopy.order.row}</dt>
            <dd className="font-semibold">−{formatPaise(totals.coinDiscountPaise)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{text.shipping}</dt>
          <dd className={cn("font-semibold", totals.shippingPaise === 0 ? "text-success" : "text-ink")}>
            {totals.shippingPaise === 0 ? text.free : formatPaise(totals.shippingPaise)}
          </dd>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-line pt-3.5">
          <dt className="text-base font-extrabold text-ink">{text.total}</dt>
          <dd className="text-2xl font-extrabold tracking-[-0.02em] text-ink">
            {formatPaise(totals.totalPaise)}
          </dd>
        </div>
      </dl>

      {totals.toFreeShippingPaise ? (
        <p className="mt-3 text-small text-brand">{text.addForFree(formatPaise(totals.toFreeShippingPaise))}</p>
      ) : null}
      {!hideNote && <p className="mt-3 text-small text-muted">{text.pricesNote}</p>}

      {children && <div className="mt-5 flex flex-col gap-3">{children}</div>}
    </section>
  );
}
