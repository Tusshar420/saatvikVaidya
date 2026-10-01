import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { CartLineItem } from "@/components/site/cart/cart-line-item";
import { OrderSummary } from "@/components/site/cart/order-summary";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/badge";
import { cart as copy } from "@/content/cart";
import { signInPath } from "@/lib/auth-routes";
import { getSession } from "@/server/auth/session";
import { readCart } from "@/server/cart/cart";
import { currentCartOwner } from "@/server/cart/request";
import { getSetting } from "@/server/content/settings";
import { getPricingViewer } from "@/server/pricing";

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false, follow: false },
};

/**
 * The cart, for guests and signed-in users. Every line is priced again for
 * the viewer on each visit; lines that can't be bought as they are (hidden,
 * sold out, under the MOQ, over the stock) say so and hold up checkout.
 */
export default async function CartPage() {
  const [viewer, owner, shipping, session] = await Promise.all([
    getPricingViewer(),
    currentCartOwner(),
    getSetting("checkout.shipping"),
    getSession(),
  ]);
  const cart = await readCart(owner, viewer, shipping);

  if (cart.lines.length === 0) {
    return (
      <div className="shell py-10 sm:py-16">
        <EmptyState
          as="h1"
          icon={<ShoppingBag aria-hidden />}
          title={copy.empty.title}
          description={copy.empty.line}
          className="mx-auto max-w-2xl py-14"
          action={
            <Link href="/products" className={buttonClasses()}>
              {copy.empty.action}
              <ButtonArrow />
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="shell py-8 sm:py-12">
      <Eyebrow>{copy.eyebrow}</Eyebrow>
      <h1 className="mt-2 text-h2 text-ink">
        {copy.title} <em className="block text-teal not-italic">{copy.titleEmphasis}</em>
      </h1>
      <p className="mt-2 text-body text-muted">{copy.itemCount(cart.lines.length)}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
        <ul aria-label={copy.listLabel} className="flex flex-col gap-4">
          {cart.lines.map((line) => (
            <CartLineItem key={line.productId} line={line} />
          ))}
        </ul>

        <OrderSummary totals={cart.totals} className="lg:sticky lg:top-40">
          {cart.hasIssues ? (
            <>
              <p id="cart-blocked" className="text-small font-bold text-danger">
                {copy.issues.summary}
              </p>
              <Button disabled aria-describedby="cart-blocked" className="w-full">
                {copy.summary.checkout}
              </Button>
            </>
          ) : (
            <Link
              href={session ? "/checkout" : signInPath("/checkout")}
              className={buttonClasses({ className: "w-full" })}
            >
              {session ? copy.summary.checkout : copy.summary.signInToCheckout}
              <ButtonArrow />
            </Link>
          )}
          <Link href="/products" className={buttonClasses({ variant: "secondary", className: "w-full" })}>
            {copy.summary.continueShopping}
          </Link>
        </OrderSummary>
      </div>
    </div>
  );
}
