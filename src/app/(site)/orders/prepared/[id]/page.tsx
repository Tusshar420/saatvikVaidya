import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, CreditCard, Lock, Phone, TimerOff, XCircle } from "lucide-react";
import { CheckoutForm } from "@/components/site/checkout/checkout-form";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Eyebrow } from "@/components/ui/badge";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { ComingSoon, EmptyState } from "@/components/ui/empty-state";
import { assistedOrders } from "@/content/assisted-orders";
import { cart as cartCopy } from "@/content/cart";
import { checkout as checkoutCopy } from "@/content/checkout";
import { checkoutOff as paused } from "@/content/maintenance";
import { isAssistedOrderId, preparedOrderPath } from "@/lib/assisted-orders";
import { formatDateTime, formatPaise } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { readPreparedOrderForCustomer } from "@/server/assisted-orders/assisted-orders";
import { requireUser } from "@/server/auth/session";
import { totalsLinesOf } from "@/server/cart/cart";
import { listAddresses } from "@/server/checkout/addresses";
import { computeTotals } from "@/server/checkout/totals";
import { checkoutOffer } from "@/server/coins/ledger";
import { getSetting } from "@/server/content/settings";
import { getPaymentProvider, paymentsAvailable } from "@/server/payments";
import { getPricingViewer } from "@/server/pricing";
import { placePreparedOrderAction, savePreparedAddressAction } from "../actions";

const copy = assistedOrders.customer;

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false, follow: false },
};

/**
 * An order our staff prepared for this customer (the link we send them):
 * the items priced for them, then the usual checkout (address, coins, place
 * order). Only the customer it was prepared for can open it.
 */
export default async function PreparedOrderPage({ params }: PageProps<"/orders/prepared/[id]">) {
  const { id } = await params;
  if (!isAssistedOrderId(id)) notFound();
  const { user } = await requireUser(preparedOrderPath(id));
  const viewer = await getPricingViewer();
  const order = await readPreparedOrderForCustomer(user.id, viewer, id);
  if (!order) notFound();
  const phone = await getSetting("contact.phone");

  const callUs = (
    <a href={telHref(phone)} className={buttonClasses({ variant: "secondary" })}>
      <Phone aria-hidden className="size-4" />
      {copy.callUs(phone)}
    </a>
  );
  const frame = (content: React.ReactNode) => <div className="shell section-y">{content}</div>;

  if (!order.mine) {
    return frame(
      <EmptyState
        as="h1"
        icon={<Lock aria-hidden />}
        title={copy.notYoursTitle}
        description={copy.notYoursLine}
        className="mx-auto max-w-2xl py-14"
      />,
    );
  }
  if (order.status === "placed") {
    return frame(
      <EmptyState
        as="h1"
        icon={<CircleCheck aria-hidden />}
        title={copy.placedTitle}
        description={copy.placedLine}
        className="mx-auto max-w-2xl py-14"
        action={
          <Link href={order.orderId ? `/orders/${order.orderId}` : "/orders"} className={buttonClasses()}>
            {order.orderId ? copy.openOrder : copy.myOrders}
            <ButtonArrow />
          </Link>
        }
      />,
    );
  }
  if (order.status === "cancelled" || order.status === "expired") {
    const cancelled = order.status === "cancelled";
    return frame(
      <EmptyState
        as="h1"
        tone="orange"
        icon={cancelled ? <XCircle aria-hidden /> : <TimerOff aria-hidden />}
        title={cancelled ? copy.cancelledTitle : copy.expiredTitle}
        description={cancelled ? copy.cancelledLine : copy.expiredLine}
        className="mx-auto max-w-2xl py-14"
        action={callUs}
      />,
    );
  }
  // The admin's checkout switch: show a notice instead of the form.
  if (!(await getSetting("checkout.enabled")).enabled) {
    return frame(
      <EmptyState
        as="h1"
        icon={<CreditCard aria-hidden />}
        title={paused.title}
        description={paused.body}
        className="mx-auto max-w-2xl py-14"
        action={callUs}
      />,
    );
  }

  const [shipping, addresses, coinRules] = await Promise.all([
    getSetting("checkout.shipping"),
    listAddresses(user.id),
    getSetting("coins.rules"),
  ]);
  const { lines, totals, hasIssues } = order.priced;
  const offer = coinRules.enabled ? await checkoutOffer(user.id, totals.subtotalPaise, coinRules) : null;
  const coinOffer =
    offer && offer.balance > 0
      ? {
          balance: offer.balance,
          coins: offer.coins,
          discountPaise: offer.discountPaise,
          totals: computeTotals(totalsLinesOf(lines), shipping, offer.discountPaise),
        }
      : null;

  return (
    <div className="shell py-8 sm:py-12">
      <Eyebrow>{copy.eyebrow}</Eyebrow>
      <h1 className="mt-2 text-h2 text-ink">
        {copy.title} <em className="block text-orange-title not-italic">{copy.titleEmphasis}</em>
      </h1>
      <p className="mt-3 max-w-2xl text-body text-muted">{copy.intro(order.preparedBy ?? copy.team)}</p>
      <p className="mt-1 text-small text-muted">{copy.expiresOn(formatDateTime(order.expiresAt))}</p>

      {order.note && (
        <section
          aria-labelledby="prepared-note"
          className="mt-5 max-w-2xl rounded-xl border border-line bg-brand-soft/50 p-4"
        >
          <h2 id="prepared-note" className="text-label text-brand uppercase">
            {copy.noteTitle}
          </h2>
          <p className="mt-1.5 text-sm whitespace-pre-line text-ink">{order.note}</p>
        </section>
      )}

      {hasIssues ? (
        <div className="mt-8 flex max-w-2xl flex-col gap-4">
          <FormAlert>{cartCopy.issues.summary}</FormAlert>
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {lines
              .filter((line) => line.issue !== null)
              .map((line) => (
                <li key={line.productId} className="font-bold">
                  {line.name}
                </li>
              ))}
          </ul>
          <div className="w-fit max-sm:w-full max-sm:*:w-full">{callUs}</div>
        </div>
      ) : (
        <CheckoutForm
          addresses={addresses}
          checkoutKey={randomUUID()}
          totals={totals}
          coinOffer={coinOffer}
          items={lines.map((line) => ({
            key: line.productId,
            name: line.name,
            detail: `${checkoutCopy.summary.quantity(line.quantity)} · ${cartCopy.line.unitPrice(formatPaise(line.unitPaise))}`,
            totalPaise: line.lineTotalPaise,
          }))}
          placeAction={placePreparedOrderAction.bind(null, order.id)}
          saveAddress={savePreparedAddressAction.bind(null, order.id)}
          placeLabel={copy.placeButton}
          {...(getPaymentProvider().name !== "test"
            ? {
                placeNote:
                  getPaymentProvider().name === "request" ? checkoutCopy.place.requestNote : checkoutCopy.place.manualNote,
              }
            : {})}
          paymentsOff={
            paymentsAvailable() ? null : (
              <ComingSoon
                icon={<CreditCard aria-hidden />}
                title={checkoutCopy.paymentsOff.title}
                description={checkoutCopy.paymentsOff.line(phone)}
                as="h3"
                className="px-4 py-6"
                action={callUs}
              />
            )
          }
        />
      )}
    </div>
  );
}
