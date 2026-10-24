"use client";

import Link from "next/link";
import { ChevronRight, Lock, Phone, UserRound } from "lucide-react";
import { SiteModalButton } from "@/components/site/site-modals";
import { buttonClasses } from "@/components/ui/button";
import { account } from "@/content/account";
import { useRefreshOnSignIn } from "./use-refresh-on-sign-in";
import { signInPath } from "@/lib/auth-routes";
import { cn } from "@/lib/cn";
import { telHref } from "@/lib/phone";

const copy = account.guest;
const cardClass = "rounded-xl border border-line bg-surface shadow-card max-sm:rounded-lg";
const rowClass =
  "group flex min-h-11 items-center gap-3 border-t border-line px-0.5 py-2.5 text-sm font-bold text-ink transition first:border-t-0 hover:text-brand";

/**
 * The "You" page for a visitor who isn't signed in: a sign-in prompt plus the
 * parts of My account they will get, so the tab is never a dead end. Once the
 * sign-in modal succeeds the page refreshes into the real account.
 */
export function GuestAccount({ phone }: { phone: string }) {
  useRefreshOnSignIn();

  return (
    <div className="bg-cream pt-7 pb-19 sm:pt-9.5 md:pt-13.5 md:pb-24">
      <div className="shell mx-auto flex max-w-2xl flex-col gap-3.25">
        <section aria-labelledby="guest-title" className={cn(cardClass, "p-5 sm:p-6.25")}>
          <span
            aria-hidden
            className="grid size-14 place-items-center rounded-[18px] bg-avatar text-white"
          >
            <UserRound className="size-6" />
          </span>
          <p className="mt-4 font-heading text-label text-orange-ink uppercase">{copy.eyebrow}</p>
          <h1 id="guest-title" className="mt-1.5 font-heading text-h3 text-ink">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-muted">{copy.description}</p>
          <ul className="mt-3.5 flex flex-wrap gap-2">
            {copy.perks.map((perk) => (
              <li
                key={perk}
                className="rounded-full bg-brand-soft px-3 py-1 text-small font-bold text-brand"
              >
                {perk}
              </li>
            ))}
          </ul>
          <SiteModalButton
            modal="signIn"
            className={cn(buttonClasses({ variant: "primary", size: "lg" }), "mt-5 w-full")}
          >
            {copy.signIn}
          </SiteModalButton>
        </section>

        <nav aria-labelledby="guest-menu" className={cn(cardClass, "p-5 sm:p-5.25")}>
          <h2 id="guest-menu" className="font-heading text-h4 text-ink">
            {copy.menuTitle}
          </h2>
          <ul className="mt-3">
            {copy.menu.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.signIn ? signInPath(item.href) : item.href}
                  className={rowClass}
                >
                  <span className="min-w-0 flex-1">
                    {item.label}
                    <span className="block text-small font-medium text-muted">{item.help}</span>
                  </span>
                  {item.signIn && (
                    <Lock aria-label={copy.menuNote} className="size-4 shrink-0 text-muted" />
                  )}
                  <ChevronRight aria-hidden className="size-4 shrink-0 opacity-50 group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="guest-explore" className={cn(cardClass, "p-5 sm:p-5.25")}>
          <h2 id="guest-explore" className="font-heading text-h4 text-ink">
            {copy.exploreTitle}
          </h2>
          <ul className="mt-3">
            {copy.explore.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={rowClass}>
                  <span className="min-w-0 flex-1">{item.label}</span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 opacity-50 group-hover:opacity-100" />
                </Link>
              </li>
            ))}
            <li>
              <SiteModalButton modal="trackOrder" className={cn(rowClass, "w-full text-left")}>
                <span className="min-w-0 flex-1">{copy.trackOrder}</span>
                <ChevronRight aria-hidden className="size-4 shrink-0 opacity-50 group-hover:opacity-100" />
              </SiteModalButton>
            </li>
          </ul>
        </section>

        <section aria-labelledby="guest-help" className={cn(cardClass, "p-5 sm:p-5.25")}>
          <h2 id="guest-help" className="font-heading text-h4 text-ink">
            {copy.helpTitle}
          </h2>
          <a
            href={telHref(phone)}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand underline-offset-4 hover:underline"
          >
            <Phone aria-hidden className="size-4" />
            {copy.call(phone)}
          </a>
        </section>
      </div>
    </div>
  );
}
