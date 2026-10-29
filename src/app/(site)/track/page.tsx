import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { OrderStatusBadge } from "@/components/site/orders/order-status-badge";
import { TrackOrderForm } from "@/components/site/orders/track-order-form";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { orders as copy } from "@/content/orders";
import { signInPath } from "@/lib/auth-routes";
import { formatDate, formatPaise } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { getSession } from "@/server/auth/session";
import { getSetting } from "@/server/content/settings";
import { listOrdersForUser } from "@/server/orders/history";

const text = copy.track;

export const metadata: Metadata = { title: text.metaTitle };

/**
 * Track an order without signing in: order number plus the phone or email on
 * it (v2 look, U.9). Signed-in buyers also see their latest orders.
 */
export default async function TrackPage() {
  const [phone, session] = await Promise.all([getSetting("contact.phone"), getSession()]);
  const recent = session ? (await listOrdersForUser(session.user.id, 1)).orders.slice(0, 3) : null;

  return (
    <>
      <PageHero
        eyebrow={text.eyebrow}
        title={text.heroTitle}
        description={text.heroDescription}
        note={{ status: text.noteStatus, title: text.noteTitle, text: text.noteText }}
      />

      <div className="bg-cream pt-7 pb-19 sm:pt-9.5 md:pt-13.5 md:pb-24">
        <div className="shell">
          <TrackOrderForm headingLevel="h2" variant="page" />

          <section aria-labelledby="previous-orders" className="mt-8.75">
            <div className="mb-5.5 flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
              <div>
                <h2 id="previous-orders" className="font-heading text-[24px] leading-[1.1] font-extrabold tracking-[-0.035em] text-ink sm:text-[28px]">
                  {text.previousTitle}
                </h2>
                <p className="mt-1.5 text-small text-muted">
                  {recent ? text.previousSignedIn : text.previousSignedOut}
                </p>
              </div>
              {recent ? (
                recent.length > 0 && (
                  <Link href="/orders" className="inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-brand hover:underline">
                    {text.viewAll}
                    <ButtonArrow />
                  </Link>
                )
              ) : (
                <Link href={signInPath("/track")} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                  {text.signIn}
                </Link>
              )}
            </div>

            {recent && (
              <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card max-sm:rounded-lg">
                {recent.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted">{text.previousEmpty}</p>
                ) : (
                  <ul>
                    {recent.map((order) => (
                      <li
                        key={order.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3.75 last:border-0 sm:px-5"
                      >
                        <div className="flex min-w-0 flex-1 flex-col">
                          <b className="text-sm break-words text-ink">{order.number}</b>
                          <small className="mt-0.5 text-small text-muted">
                            {copy.list.placedOn(formatDate(order.createdAt))} · {copy.list.items(order.itemCount)}
                          </small>
                        </div>
                        <OrderStatusBadge status={order.status} />
                        <span className="text-sm font-extrabold text-ink tabular-nums">{formatPaise(order.totalPaise)}</span>
                        <Link
                          href={`/orders/${order.id}`}
                          aria-label={copy.list.viewLabel(order.number)}
                          className="inline-flex min-h-11 items-center rounded-sm bg-brand-soft px-3 text-small font-extrabold text-brand hover:bg-brand hover:text-white"
                        >
                          {copy.list.view}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <p className="mt-5 text-sm text-muted">
              {text.helpLead}{" "}
              <a
                href={telHref(phone)}
                className="inline-flex min-h-11 items-center gap-1.5 font-bold text-brand underline-offset-4 hover:underline"
              >
                <Phone aria-hidden className="size-4" />
                {text.call(phone)}
              </a>
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
