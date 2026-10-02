import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CoinIcon } from "@/components/ui/coin-pill";
import { Eyebrow } from "@/components/ui/badge";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { coins as copy } from "@/content/coins";
import { coinReasonText } from "@/lib/coin-reason";
import { signInPath } from "@/lib/auth-routes";
import { cn } from "@/lib/cn";
import { coinValuePaise } from "@/lib/coins";
import { formatDate, formatINR, formatNumber, formatPaise } from "@/lib/format";
import { getSession } from "@/server/auth/session";
import { COIN_PAGE_SIZE, coinSummary, readCoinHistory } from "@/server/coins/ledger";
import { getSetting } from "@/server/content/settings";
import { db } from "@/server/db";

export const metadata: Metadata = { title: copy.metaTitle };

function pageOf(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 && page <= 10_000 ? page : 1;
}

/**
 * Super Coins. Everyone sees how to earn and use them; a signed-in user also
 * sees their balance and history (read from the ledger on every visit).
 */
export default async function CoinsPage({ searchParams }: PageProps<"/coins">) {
  const [session, rules] = await Promise.all([getSession(), getSetting("coins.rules")]);
  const page = pageOf((await searchParams).page);
  const [summary, history] = session
    ? await Promise.all([coinSummary(db, session.user.id), readCoinHistory(session.user.id, page)])
    : [null, null];
  const pageCount = history ? Math.max(1, Math.ceil(history.total / COIN_PAGE_SIZE)) : 1;
  const pageHref = (target: number) => (target > 1 ? `/coins?page=${target}` : "/coins");

  return (
    <div className="shell section-y">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-h2 text-ink">{copy.title}</h1>

        {!rules.enabled && (
          <p role="status" className="mt-6 rounded-lg bg-gold-soft p-4 text-sm font-semibold text-gold-ink">
            {copy.paused}
          </p>
        )}

        {summary ? (
          <section
            aria-labelledby="coin-balance"
            className="mt-6 flex items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
          >
            <CoinIcon className="size-12 text-xl" />
            <div className="min-w-0">
              <h2 id="coin-balance" className="text-small font-bold text-muted">
                {copy.balance.label}
              </h2>
              <p className="text-3xl font-extrabold tracking-[-0.02em] text-ink">
                {copy.balance.coins(summary.balance)}
              </p>
              <p className="text-small text-muted">
                {copy.balance.worth(formatPaise(coinValuePaise(summary.balance, rules)))}
                {summary.nextExpiry && (
                  <>
                    {" · "}
                    {copy.balance.expiry(summary.nextExpiry.coins, formatDate(summary.nextExpiry.at))}
                  </>
                )}
              </p>
            </div>
          </section>
        ) : (
          <div className="mt-6 flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <p className="text-body text-ink">{copy.signedOutLine}</p>
            <Link href={signInPath("/coins")} className={buttonClasses({ className: "max-sm:w-full" })}>
              {copy.signIn}
              <ButtonArrow />
            </Link>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <section aria-labelledby="coin-earn" className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <h2 id="coin-earn" className="text-h3 text-ink">
              {copy.earn.title}
            </h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm text-ink">
              <li>
                {copy.earn.order(rules.earnPerThousandRupees, formatINR(1_000), rules.earnAfterDelivery)}
              </li>
              {rules.interestsReward > 0 && <li>{copy.earn.interests(rules.interestsReward)}</li>}
              {rules.quizReward > 0 && <li>{copy.earn.quiz(rules.quizReward)}</li>}
              {rules.detailsReward > 0 && <li>{copy.earn.details(rules.detailsReward)}</li>}
              <li>{copy.earn.expiry(rules.expiryMonths)}</li>
            </ul>
          </section>
          <section aria-labelledby="coin-use" className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <h2 id="coin-use" className="text-h3 text-ink">
              {copy.use.title}
            </h2>
            <p className="mt-3 text-sm text-ink">{copy.use.line(rules.coinsPerRupee, rules.maxRedeemPercent)}</p>
            <Link href="/products" className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-4" })}>
              {copy.use.shop}
              <ButtonArrow />
            </Link>
          </section>
        </div>

        {history && (
          <section aria-labelledby="coin-history" className="mt-8">
            <h2 id="coin-history" className="text-h3 text-ink">
              {copy.history.title}
            </h2>
            {history.items.length === 0 ? (
              <p className="mt-3 text-body text-muted">{copy.history.empty}</p>
            ) : (
              <ul aria-label={copy.history.title} className="mt-3 flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-card">
                {history.items.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold break-words text-ink">{coinReasonText(entry)}</p>
                      <p className="text-small text-muted">
                        {formatDate(entry.createdAt)}
                        {entry.expiresAt && entry.amount > 0 && ` · ${copy.history.expiresOn(formatDate(entry.expiresAt))}`}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 text-base font-extrabold",
                        entry.amount < 0 ? "text-danger" : "text-green",
                      )}
                    >
                      <span className="sr-only">{entry.amount < 0 ? "−" : "+"}</span>
                      <span aria-hidden>{entry.amount < 0 ? "−" : "+"}</span>
                      {formatNumber(Math.abs(entry.amount))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {pageCount > 1 && (
              <nav
                aria-label={copy.history.pageOf(page, pageCount)}
                className="mt-6 flex items-center justify-between gap-3"
              >
                {page > 1 ? (
                  <Link href={pageHref(page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                    <ChevronLeft aria-hidden className="size-4" />
                    {copy.history.prev}
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-small text-muted">{copy.history.pageOf(page, pageCount)}</span>
                {page < pageCount ? (
                  <Link href={pageHref(page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                    {copy.history.next}
                    <ChevronRight aria-hidden className="size-4" />
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
