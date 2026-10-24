import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { CoinIcon } from "@/components/ui/coin-pill";
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

  const formulaCoins = rules.earnPerThousandRupees * 10;
  const ruleCards = [
    {
      id: "coin-earn",
      icon: copy.rules.earnIcon,
      title: copy.earn.title,
      body: (
        <>
          <p>{copy.earn.order(rules.earnPerThousandRupees, formatINR(1_000), rules.earnAfterDelivery)}</p>
          <p className="mt-1">{copy.earn.extras(rules.quizReward, rules.interestsReward, rules.detailsReward)}</p>
        </>
      ),
    },
    {
      id: "coin-use",
      icon: copy.rules.useIcon,
      title: copy.use.title,
      body: (
        <>
          <p>{copy.use.line(rules.coinsPerRupee, rules.maxRedeemPercent)}</p>
          <Link href="/products" className="mt-2 inline-flex min-h-11 items-center gap-1 font-extrabold text-brand hover:underline">
            {copy.use.shop}
            <ButtonArrow />
          </Link>
        </>
      ),
    },
    {
      id: "coin-validity",
      icon: rules.expiryMonths > 0 ? String(rules.expiryMonths) : "∞",
      title: copy.rules.validityTitle,
      body: <p>{copy.rules.validity(rules.expiryMonths)}</p>,
    },
    {
      id: "coin-clear",
      icon: copy.rules.historyIcon,
      title: copy.rules.historyTitle,
      body: <p>{summary ? copy.rules.historyTextSignedIn : copy.rules.historyText}</p>,
    },
  ];

  return (
    <>
      <PageHero
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.hero.description}
        note={{
          status: copy.hero.status,
          title: copy.hero.noteTitle,
          text: copy.hero.noteText(rules.coinsPerRupee, rules.expiryMonths),
        }}
      />

      <div className="bg-cream pt-7 pb-19 sm:pt-9.5 md:pt-13.5 md:pb-24">
        <div className="shell">
          {!rules.enabled && (
            <p role="status" className="mb-5 rounded-md bg-gold-soft p-4 text-sm font-semibold text-gold-ink">
              {copy.paused}
            </p>
          )}

          <div className="grid gap-5.5 lg:grid-cols-[1fr_1.4fr]">
            <section
              aria-labelledby="coin-balance"
              className="flex flex-col rounded-xl bg-forest p-5.75 text-white shadow-forest max-sm:rounded-lg sm:p-7.5"
            >
              <p className="font-heading text-label text-gold-light uppercase">{copy.wallet.eyebrow}</p>
              {summary ? (
                <>
                  <h2 id="coin-balance" className="sr-only">
                    {copy.balance.label}
                  </h2>
                  <div className="mt-3 flex items-center gap-3">
                    <CoinIcon className="size-11 text-lg" />
                    <p className="font-heading text-[32px] leading-tight font-extrabold tracking-[-0.03em]">
                      {copy.balance.coins(summary.balance)}
                    </p>
                  </div>
                  <p className="mt-1.5 text-small text-forest-ink">
                    {copy.balance.worth(formatPaise(coinValuePaise(summary.balance, rules)))}
                    {summary.nextExpiry && (
                      <>
                        {" · "}
                        {copy.balance.expiry(summary.nextExpiry.coins, formatDate(summary.nextExpiry.at))}
                      </>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <h2 id="coin-balance" className="mt-3 font-heading text-[28px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[32px]">
                    {copy.wallet.signedOutTitle}
                  </h2>
                  <p className="mt-1.5 text-small text-forest-ink">{copy.signedOutLine}</p>
                </>
              )}

              {rules.earnPerThousandRupees > 0 && (
                <div className="my-7 flex items-center gap-3.5">
                  <div className="flex flex-col">
                    <b className="font-heading text-[21px] font-extrabold">{formatINR(10_000)}</b>
                    <small className="text-small text-forest-ink">{copy.wallet.formulaOrder}</small>
                  </div>
                  <ArrowRight aria-hidden className="size-4 shrink-0 text-forest-ink" />
                  <div className="flex flex-col">
                    <b className="font-heading text-[21px] font-extrabold">{copy.wallet.formulaCoins(formulaCoins)}</b>
                    <small className="text-small text-forest-ink">
                      {copy.wallet.formulaWorth(formatPaise(coinValuePaise(formulaCoins, rules)))}
                    </small>
                  </div>
                </div>
              )}

              <div className="mt-auto">
                {summary ? (
                  <Link href="/products" className={buttonClasses({ variant: "light", className: "w-full" })}>
                    {copy.use.shop}
                    <ButtonArrow />
                  </Link>
                ) : (
                  <Link href={signInPath("/coins")} className={buttonClasses({ variant: "light", className: "w-full" })}>
                    {copy.wallet.signIn}
                  </Link>
                )}
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              {ruleCards.map((card) => (
                <section
                  key={card.id}
                  aria-labelledby={card.id}
                  className="rounded-xl border border-line bg-surface p-5.25 shadow-card max-sm:rounded-lg"
                >
                  <div
                    aria-hidden
                    className="grid size-9.5 place-items-center rounded-[11px] bg-gold-soft font-heading text-sm font-extrabold text-gold-ink"
                  >
                    {card.icon}
                  </div>
                  <h2 id={card.id} className="mt-3.5 mb-1.25 font-heading text-h4 text-ink">
                    {card.title}
                  </h2>
                  <div className="text-small text-muted">{card.body}</div>
                </section>
              ))}
            </div>
          </div>

          <section
            aria-labelledby="coin-history"
            className="mt-5.5 overflow-hidden rounded-xl border border-line bg-surface shadow-card max-sm:rounded-lg"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4.5 sm:px-6 sm:py-5.25">
              <h2 id="coin-history" className="font-heading text-[17px] font-extrabold text-ink sm:text-h4">
                {copy.history.title}
              </h2>
              {history ? (
                <span className="rounded-sm bg-brand-soft px-2.5 py-1.5 text-label text-brand uppercase">
                  {copy.history.entries(history.total)}
                </span>
              ) : (
                <span className="rounded-sm bg-gold-soft px-2.5 py-1.5 text-label text-gold-ink uppercase">
                  {copy.history.signInRequired}
                </span>
              )}
            </div>

            {!history ? (
              <ul>
                {copy.history.kinds.map((kind, index) => (
                  <li
                    key={kind.title}
                    className="grid grid-cols-[1fr_auto] items-center gap-2.5 border-b border-line px-4 py-3.5 last:border-0 sm:grid-cols-[1fr_110px_120px] sm:px-6"
                  >
                    <span className="flex min-w-0 flex-col">
                      <b className="text-sm text-ink">{kind.title}</b>
                      <small className="mt-0.5 text-small text-muted">{kind.text}</small>
                    </span>
                    <strong className={cn("text-sm font-extrabold", index === 2 ? "text-orange-ink" : "text-brand")}>
                      {kind.amount}
                    </strong>
                    <em className="text-small text-muted not-italic max-sm:hidden">{kind.note}</em>
                  </li>
                ))}
              </ul>
            ) : history.items.length === 0 ? (
              <p className="px-4 py-6 text-body text-muted sm:px-6">{copy.history.empty}</p>
            ) : (
              <ul aria-label={copy.history.title}>
                {history.items.map((entry) => (
                  <li
                    key={entry.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-2.5 border-b border-line px-4 py-3.5 last:border-0 sm:grid-cols-[1fr_110px_160px] sm:px-6"
                  >
                    <span className="flex min-w-0 flex-col">
                      <b className="text-sm break-words text-ink">{coinReasonText(entry)}</b>
                      <small className="mt-0.5 text-small text-muted">{formatDate(entry.createdAt)}</small>
                    </span>
                    <strong
                      className={cn(
                        "text-sm font-extrabold tabular-nums sm:text-base",
                        entry.amount < 0 ? "text-orange-ink" : "text-brand",
                      )}
                    >
                      <span className="sr-only">{entry.amount < 0 ? "−" : "+"}</span>
                      <span aria-hidden>{entry.amount < 0 ? "− " : "+ "}</span>
                      {formatNumber(Math.abs(entry.amount))}
                    </strong>
                    <em className="text-small text-muted not-italic max-sm:hidden">
                      {entry.expiresAt && entry.amount > 0
                        ? copy.history.expiresOn(formatDate(entry.expiresAt))
                        : "—"}
                    </em>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {history && pageCount > 1 && (
            <nav aria-label={copy.history.pageOf(page, pageCount)} className="mt-6 flex items-center justify-between gap-3">
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
        </div>
      </div>
    </>
  );
}
