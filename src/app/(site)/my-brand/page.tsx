import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { OrderStatusBadge } from "@/components/site/orders/order-status-badge";
import { Eyebrow } from "@/components/ui/badge";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { brand as copy } from "@/content/brand";
import { formatDate, formatPaise } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { brandCartCount } from "@/server/brand/cart";
import { listBrandOrdersForUser } from "@/server/brand/orders";

const text = copy.myBrand;

export const metadata: Metadata = {
  title: text.metaTitle,
  robots: { index: false, follow: false },
};

/** "My Brand" (P2.1): the signed-in user's Launch Your Brand orders, newest first, and a link back to an unfinished Launch cart. */
export default async function MyBrandPage() {
  const { user } = await requireUser("/my-brand");
  const [orders, inCart] = await Promise.all([listBrandOrdersForUser(user.id), brandCartCount(user.id)]);

  const start = (
    <Link href={inCart > 0 ? "/launch?step=2" : "/launch"} className={buttonClasses()}>
      {inCart > 0 ? text.continueDraft : text.start}
      <ButtonArrow />
    </Link>
  );

  return (
    <div className="shell section-y">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>{text.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-h2 text-ink">
          {text.title} <em className="block text-orange-title not-italic">{text.titleEmphasis}</em>
        </h1>

        {orders.length === 0 ? (
          <EmptyState
            as="h2"
            icon={<Sparkles aria-hidden />}
            title={text.empty.title}
            description={text.empty.line}
            className="mt-8"
            action={start}
          />
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-cream p-4">
              <p className="min-w-0 flex-1 text-sm text-ink">
                {inCart > 0 ? text.draftLine(inCart) : text.another}
              </p>
              <div className="max-sm:w-full max-sm:*:w-full">{start}</div>
            </div>
            <ul aria-label={text.listLabel} className="mt-6 flex flex-col gap-4">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <h2 className="text-lg font-extrabold break-words text-ink">{order.brandName}</h2>
                      <p className="font-mono text-small font-bold text-muted">{order.number}</p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <ul className="mt-3 flex flex-col gap-0.5 text-sm break-words text-ink">
                    {order.items.slice(0, 3).map((item, index) => (
                      <li key={index}>
                        {item.productName} · {text.units(item.quantity, item.unitLabel ?? "")}
                      </li>
                    ))}
                    {order.items.length > 3 && <li className="text-muted">{text.more(order.items.length - 3)}</li>}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-small text-muted">
                      {text.placedOn(formatDate(order.createdAt))} ·{" "}
                      <span className="font-bold text-ink">{formatPaise(order.totalPaise)}</span>
                    </p>
                    <Link
                      href={`/my-brand/${order.id}`}
                      aria-label={text.viewLabel(order.number)}
                      className={buttonClasses({ variant: "secondary", size: "sm", className: "max-sm:w-full" })}
                    >
                      {text.view}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
