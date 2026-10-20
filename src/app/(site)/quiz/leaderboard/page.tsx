import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { clock, quiz as copy } from "@/content/quiz";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { LeaderboardPeriod } from "@/lib/quiz";
import { getSession } from "@/server/auth/session";
import { readLeaderboard } from "@/server/quiz/view";

export const metadata: Metadata = { title: copy.leaderboard.metaTitle };

const text = copy.leaderboard;
const periods: LeaderboardPeriod[] = ["week", "month"];

function periodOf(value: string | string[] | undefined): LeaderboardPeriod {
  return (Array.isArray(value) ? value[0] : value) === "month" ? "month" : "week";
}

/**
 * The weekly and monthly leaderboards (P2.3): public, first name and last
 * initial only. A signed-in user also sees their own rank.
 */
export default async function LeaderboardPage({ searchParams }: PageProps<"/quiz/leaderboard">) {
  const period = periodOf((await searchParams).period);
  const session = await getSession();
  const board = await readLeaderboard(period, session?.user.id ?? null);
  const shownYou = board.rows.some((row) => row.isYou);

  return (
    <div className="shell section-y">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>{text.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-h2 text-ink">{text.title}</h1>
        <p className="mt-2 text-sm text-muted">{text.description}</p>

        <nav aria-label={text.periodsLabel} className="mt-6 flex gap-2">
          {periods.map((item) => (
            <Link
              key={item}
              href={item === "week" ? "/quiz/leaderboard" : `/quiz/leaderboard?period=${item}`}
              aria-current={item === period ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-button border px-4 text-sm font-bold transition",
                item === period
                  ? "border-brand bg-brand text-white"
                  : "border-line-strong bg-surface text-brand hover:border-brand",
              )}
            >
              {text.periods[item]}
            </Link>
          ))}
        </nav>
        <p className="mt-2 text-small text-muted">
          {formatDate(board.from)} – {formatDate(new Date(board.until.getTime() - 1))}
        </p>

        {session && (
          <p role="status" data-testid="your-rank" className="mt-4 rounded-lg bg-brand-soft p-3 text-sm font-bold text-ink">
            {board.you ? text.yourRank(board.you.rank) : text.notRanked}
          </p>
        )}

        {board.rows.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-line-strong bg-surface-alt p-8 text-center text-sm text-muted">
            {text.empty}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
            <table className="w-full min-w-80 text-left text-sm">
              <caption className="sr-only">
                {text.title}: {text.periods[period]}
              </caption>
              <thead className="bg-surface-alt text-label text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">{text.columns.rank}</th>
                  <th scope="col" className="px-4 py-3">{text.columns.name}</th>
                  <th scope="col" className="px-4 py-3 text-right">{text.columns.score}</th>
                  <th scope="col" className="px-4 py-3 text-right">{text.columns.time}</th>
                </tr>
              </thead>
              <tbody>
                {[...board.rows, ...(board.you && !shownYou ? [board.you] : [])].map((row, index) => (
                  <tr
                    key={`${row.rank}-${index}`}
                    data-testid="leaderboard-row"
                    className={cn("border-t border-line", row.isYou && "bg-brand-soft font-bold")}
                  >
                    <td className="px-4 py-3 tabular-nums">{row.rank}</td>
                    <td className="px-4 py-3 break-words">
                      {row.name}
                      {row.isYou && <span className="ml-2 text-small text-brand">({text.you})</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.score}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{clock(row.seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3 max-sm:*:w-full">
          <Link href="/quiz" className={buttonClasses()}>
            {text.play}
          </Link>
        </div>
      </div>
    </div>
  );
}
