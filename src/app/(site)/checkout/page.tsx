import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, Phone } from "lucide-react";
import { CheckoutForm } from "@/components/site/checkout/checkout-form";
import { FormAlert } from "@/components/site/auth/form-alert";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { ComingSoon, EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/badge";
import { cart as cartCopy } from "@/content/cart";
import { courses as coursesCopy } from "@/content/courses";
import { checkout as copy } from "@/content/checkout";
import { checkoutOff as paused } from "@/content/maintenance";
import { formatPaise } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { requireUser } from "@/server/auth/session";
import { readCart, totalsLinesOf } from "@/server/cart/cart";
import { checkoutOffer } from "@/server/coins/ledger";
import { computeTotals } from "@/server/checkout/totals";
import { listAddresses } from "@/server/checkout/addresses";
import { getSetting } from "@/server/content/settings";
import { getPaymentProvider, paymentsAvailable } from "@/server/payments";
import { getPricingViewer } from "@/server/pricing";

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false, follow: false },
};

/**
 * Checkout (sign-in required): delivery address and the order summary with
 * its GST and delivery charge, priced again for this user on every visit.
 * Placing the order opens the payment screen.
 */
export default async function CheckoutPage() {
  const { user } = await requireUser("/checkout");
  // The admin's checkout switch: show a notice instead of the form.
  if (!(await getSetting("checkout.enabled")).enabled) {
    return (
      <div className="shell section-y">
        <EmptyState
          as="h1"
          icon={<CreditCard aria-hidden />}
          title={paused.title}
          description={paused.body}
          className="mx-auto max-w-2xl py-14"
          action={
            <Link href="/cart" className={buttonClasses()}>
              {paused.backToCart}
              <ButtonArrow />
            </Link>
          }
        />
      </div>
    );
  }
  const [viewer, shipping, discount, addresses, phone, coinRules] = await Promise.all([
    getPricingViewer(),
    getSetting("checkout.shipping"),
    getSetting("pricing.discount"),
    listAddresses(user.id),
    getSetting("contact.phone"),
    getSetting("coins.rules"),
  ]);
  const cart = await readCart({ kind: "user", userId: user.id }, viewer, shipping, discount.percent);
  if (cart.lines.length === 0 && cart.ebooks.length === 0 && cart.courses.length === 0) redirect("/cart");
  const digitalOnly = cart.lines.length === 0;
  // What the buyer's coins could take off this order, if they choose to use
  // them. The server works it out again when the order is placed.
  const offer = coinRules.enabled
    ? await checkoutOffer(user.id, cart.totals.subtotalPaise, coinRules)
    : null;
  const coinOffer =
    offer && offer.balance > 0
      ? {
          balance: offer.balance,
          coins: offer.coins,
          discountPaise: offer.discountPaise,
          totals: computeTotals(
            totalsLinesOf(cart.lines, cart.ebooks, cart.courses),
            shipping,
            offer.discountPaise,
          ),
        }
      : null;

  return (
    <div className="shell py-8 sm:py-12">
      <Eyebrow>{copy.eyebrow}</Eyebrow>
      <h1 className="mt-2 text-h2 text-ink">
        {copy.title}{" "}
        <em className="block text-orange-title not-italic">
          {digitalOnly ? copy.digitalTitleEmphasis : copy.titleEmphasis}
        </em>
      </h1>

      {cart.hasIssues ? (
        <div className="mt-8 flex max-w-2xl flex-col gap-4">
          <FormAlert>{cartCopy.issues.summary}</FormAlert>
          <Link href="/cart" className={buttonClasses({ className: "w-fit max-sm:w-full" })}>
            {copy.summary.editCart}
            <ButtonArrow />
          </Link>
        </div>
      ) : (
        <CheckoutForm
          digitalOnly={digitalOnly}
          addresses={addresses}
          checkoutKey={randomUUID()}
          totals={cart.totals}
          coinOffer={coinOffer}
          items={[
            ...cart.lines.map((line) => ({
              key: line.productId,
              name: line.name,
              detail: `${copy.summary.quantity(line.quantity)} · ${cartCopy.line.unitPrice(formatPaise(line.unitPaise))}`,
              totalPaise: line.lineTotalPaise,
            })),
            ...cart.ebooks.map((line) => ({
              key: `ebook-${line.ebookId}`,
              name: line.title,
              detail: cartCopy.ebook.kind,
              totalPaise: line.lineTotalPaise,
            })),
            ...cart.courses.map((line) => ({
              key: `course-${line.courseId}`,
              name: line.title,
              detail: coursesCopy.cartLine.kind,
              totalPaise: line.lineTotalPaise,
            })),
          ]}
          {...(getPaymentProvider().name !== "test"
            ? { placeLabel: copy.place.manualButton, placeNote: getPaymentProvider().name === "request" ? copy.place.requestNote : copy.place.manualNote }
            : {})}
          paymentsOff={
            paymentsAvailable() ? null : (
              <ComingSoon
                icon={<CreditCard aria-hidden />}
                title={copy.paymentsOff.title}
                description={copy.paymentsOff.line(phone)}
                as="h3"
                className="px-4 py-6"
                action={
                  <a href={telHref(phone)} className={buttonClasses({ variant: "secondary" })}>
                    <Phone aria-hidden className="size-4" />
                    {phone}
                  </a>
                }
              />
            )
          }
        />
      )}
      {!cart.hasIssues && (
        <p className="mt-6">
          <Link
            href="/cart"
            className="inline-flex min-h-11 items-center text-sm font-bold text-brand hover:underline"
          >
            {copy.summary.editCart}
          </Link>
        </p>
      )}
    </div>
  );
}
