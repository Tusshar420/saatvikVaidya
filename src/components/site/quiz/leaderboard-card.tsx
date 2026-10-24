import type { ReactNode } from "react";
import Link from "next/link";
import { clock, quiz as copy } from "@/content/quiz";
import { cn } from "@/lib/cn";
import type { LeaderboardPeriod } from "@/lib/quiz";
import type { Leaderboard } from "@/server/quiz/view";

const text = copy.leaderboard;
const periods: LeaderboardPeriod[] = ["week", "month"];

type LeaderboardCardProps = {
  board: Leaderboard;
  /** Link for each period tab. */
  hrefFor: (period: LeaderboardPeriod) => string;
  /** How many rows to show (the side card shows the top five). */
  limit?: number;
  /** Heading level for the card title. */
  headingAs?: "h2" | "h3";
  /** Range line under the tabs, e.g. "6 Oct 2026 – 12 Oct 2026". */
  range?: string;
  /** Adds the e2e test ids on the full leaderboard page. */
  testIds?: boolean;
  /** Extra line under the rows (the signed-in user's own rank). */
  footer?: ReactNode;
  /** The ranking rule line at the bottom (off where the page already says it). */
  showNote?: boolean;
  className?: string;
};

/**
 * The v2 leaderboard card (`.leaderboard`): a dark green head with the gold
 * eyebrow, title and This week / This month pill tabs, then one row per
 * player: rank, name, points and time.
 */
export function LeaderboardCard({
  board,
  hrefFor,
  limit,
  headingAs: Heading = "h2",
  range,
  testIds = false,
  footer,
  showNote = true,
  className,
}: LeaderboardCardProps) {
  const shownYou = board.rows.some((row) => row.isYou);
  const rows = limit
    ? board.rows.slice(0, limit)
    : [...board.rows, ...(board.you && !shownYou ? [board.you] : [])];

  return (
    <section
      aria-labelledby="leaderboard-title"
      className={cn("overflow-hidden rounded-xl border border-line bg-surface shadow-card max-sm:rounded-lg", className)}
    >
      <div className="bg-brand p-5.25 text-white">
        <p className="font-heading text-label text-gold-light uppercase">{copy.board.eyebrow}</p>
        <Heading id="leaderboard-title" className="mt-1.25 font-heading text-[20px] font-extrabold tracking-[-0.02em]">
          {board.period === "month" ? copy.board.titleMonth : copy.board.title}
        </Heading>
        <nav aria-label={text.periodsLabel} className="mt-3.25 flex flex-wrap gap-1.5">
          {periods.map((item) => (
            <Link
              key={item}
              href={hrefFor(item)}
              scroll={false}
              aria-current={item === board.period ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-sm border px-3.5 text-small font-bold transition sm:min-h-9",
                item === board.period
                  ? "border-orange-strong bg-orange-strong text-white"
                  : "border-white/20 text-forest-ink hover:border-white/50 hover:text-white",
              )}
            >
              {text.periods[item]}
            </Link>
          ))}
        </nav>
        {range && <p className="mt-2.5 text-small text-forest-ink">{range}</p>}
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">{text.empty}</p>
      ) : (
        <table className="w-full text-left">
          <caption className="sr-only">
            {text.title}: {text.periods[board.period]}
          </caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">{text.columns.rank}</th>
              <th scope="col">{text.columns.name}</th>
              <th scope="col">{text.columns.score}</th>
              <th scope="col">{text.columns.time}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.rank}-${index}`}
                data-testid={testIds ? "leaderboard-row" : undefined}
                className={cn("border-b border-line", row.isYou && "bg-brand-soft")}
              >
                <td className="w-10 py-3 pr-1 pl-4 font-heading text-small font-extrabold text-muted tabular-nums sm:pl-4.25">
                  {row.rank}
                </td>
                <td className="py-3 pr-2 text-sm font-bold break-words text-ink">
                  {row.name}
                  {row.isYou && <span className="ml-1.5 text-small text-brand">({text.you})</span>}
                </td>
                <td className="py-3 pr-2 text-right text-small font-extrabold text-ink tabular-nums">{row.score}</td>
                <td className="py-3 pr-4 text-right text-small font-extrabold text-ink tabular-nums sm:pr-4.25">
                  {clock(row.seconds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {footer}
      {showNote ? (
        <p className="px-4.25 py-3 text-small leading-normal text-muted">{copy.board.note}</p>
      ) : (
        <div className="h-4" />
      )}
    </section>
  );
}
