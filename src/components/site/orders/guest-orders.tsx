"use client";

import Link from "next/link";
import { Package, Truck } from "lucide-react";
import { useRefreshOnSignIn } from "@/components/site/account/use-refresh-on-sign-in";
import { SiteModalButton } from "@/components/site/site-modals";
import { Eyebrow } from "@/components/ui/badge";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { orders } from "@/content/orders";
import { cn } from "@/lib/cn";

const text = orders.guest;
const cardClass = "rounded-xl border border-line bg-surface p-5 shadow-card max-sm:rounded-lg sm:p-6";

/**
 * /orders for a visitor who isn't signed in: a sign-in prompt, plus the
 * guest-friendly ways to follow an order (track by number) or keep shopping.
 * Refreshes into the real order list once they sign in.
 */
export function GuestOrders() {
  useRefreshOnSignIn();
  return (
    <div className="shell section-y">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>{orders.list.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-h2 text-ink">
          {text.pageTitle} <em className="block text-orange-title not-italic">{text.pageTitleEmphasis}</em>
        </h1>

        <section aria-labelledby="guest-orders-title" className={cn(cardClass, "mt-8")}>
          <span aria-hidden className="grid size-14 place-items-center rounded-[18px] bg-avatar text-white">
            <Package className="size-6" />
          </span>
          <h2 id="guest-orders-title" className="mt-4 font-heading text-h4 text-ink">
            {text.title}
          </h2>
          <p className="mt-2 text-sm text-muted">{text.description}</p>
          <ul className="mt-3.5 flex flex-wrap gap-2">
            {text.perks.map((perk) => (
              <li key={perk} className="rounded-full bg-brand-soft px-3 py-1 text-small font-bold text-brand">
                {perk}
              </li>
            ))}
          </ul>
          <SiteModalButton
            modal="signIn"
            className={cn(buttonClasses({ size: "lg" }), "mt-5 w-full sm:w-auto")}
          >
            {text.signIn}
          </SiteModalButton>
        </section>

        <section aria-labelledby="guest-orders-track" className={cn(cardClass, "mt-3.25")}>
          <span aria-hidden className="text-brand">
            <Truck className="size-5" />
          </span>
          <h2 id="guest-orders-track" className="mt-2 font-heading text-h4 text-ink">
            {text.trackTitle}
          </h2>
          <p className="mt-1.5 text-sm text-muted">{text.trackText}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <SiteModalButton modal="trackOrder" className={buttonClasses({ variant: "secondary" })}>
              {text.trackOrder}
            </SiteModalButton>
            <Link href="/products" className={buttonClasses({ variant: "link" })}>
              {text.shop}
              <ButtonArrow />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
