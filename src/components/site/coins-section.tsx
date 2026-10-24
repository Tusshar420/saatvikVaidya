import Link from "next/link";
import { Coins } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { home as copy } from "@/content/home";
import { formatNumber } from "@/lib/format";
import type { SectionHeading as Heading } from "@/server/content/home";
import type { CoinMaths } from "@/server/content/home-live";

const text = copy.coins;

/** v2 coins strip (`.coins-section`): gold band with the ₹10,000 → coins → ₹ maths from the coin rules. */
export function CoinsSection({ heading, maths }: { heading: Heading; maths: CoinMaths }) {
  const href = heading.link?.href?.startsWith("/") ? heading.link.href : "/coins";
  const notes = text.notes(`${maths.coinsPerRupee} Coins = ₹1`, maths.expiryMonths);
  return (
    <section id="coins" aria-labelledby="coins-title" className="bg-coins-band py-10.5 text-ink sm:py-13.5">
      <div className="shell reveal grid items-center gap-6.25 md:grid-cols-2 md:gap-8.75 lg:grid-cols-[1fr_1.1fr_auto]">
        <div className="flex items-center gap-3.75">
          <span aria-hidden className="grid size-12.5 shrink-0 place-items-center rounded-[18px] bg-brand-dark text-gold-light sm:size-14.75">
            <Coins className="size-7.5" />
          </span>
          <div className="flex flex-col">
            <span className="font-heading text-[11px] font-extrabold tracking-[0.12em] uppercase">
              {heading.eyebrow ?? text.kicker}
            </span>
            <h2 id="coins-title" className="my-0.75 text-[23px] font-extrabold tracking-[-0.035em] sm:text-[27px]">
              {heading.title ?? text.title}
            </h2>
            <p className="m-0 text-small text-gold-ink">{heading.description ?? text.body}</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {[
            { value: `₹${formatNumber(maths.orderRupees)}`, label: text.order },
            { value: formatNumber(maths.coins), label: text.earned },
            { value: `₹${formatNumber(maths.valueRupees)}`, label: text.value },
          ].map((item, index) => (
            <div key={item.label} className="flex items-center gap-2 sm:gap-4">
              {index > 0 && (
                <span aria-hidden className="text-lg text-gold-ink sm:text-[22px]">
                  {index === 1 ? "→" : "="}
                </span>
              )}
              <div className="flex flex-col text-center">
                <span className="order-last mt-0.75 text-[11px] text-gold-ink">{item.label}</span>
                <span className="m-0 font-heading text-lg font-extrabold sm:text-[22px]">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
        <Link
          href={href}
          className={buttonClasses({ variant: "light", className: "justify-self-center bg-surface text-brand md:col-span-2 lg:col-span-1" })}
        >
          {heading.link?.label ?? text.view}
        </Link>
      </div>
      <p className="shell mt-6 mb-0 flex flex-wrap items-center justify-center gap-x-3.25 gap-y-1 text-[11px] text-gold-ink">
        {notes.map((note, index) => (
          <span key={note} className="flex items-center gap-3.25">
            {index > 0 && <span aria-hidden className="size-0.75 rounded-full bg-gold-ink" />}
            {note}
          </span>
        ))}
      </p>
    </section>
  );
}
