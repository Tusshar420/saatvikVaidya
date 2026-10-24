import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { LeaderboardCard } from "@/components/site/quiz/leaderboard-card";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { quiz as copy } from "@/content/quiz";
import { formatDate } from "@/lib/format";
import type { LeaderboardPeriod } from "@/lib/quiz";
import { getSession } from "@/server/auth/session";
import { readLeaderboard } from "@/server/quiz/view";

export const metadata: Metadata = { title: copy.leaderboard.metaTitle };

const text = copy.leaderboard;

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

  return (
    <>
      <PageHero eyebrow={text.eyebrow} title={text.title} description={text.description} />
      <div className="bg-cream pt-7 pb-19 sm:pt-9.5 md:pt-13.5 md:pb-24">
        <div className="shell">
          <div className="mx-auto max-w-170">
            <LeaderboardCard
              board={board}
              testIds
              showNote={false}
              range={`${formatDate(board.from)} – ${formatDate(new Date(board.until.getTime() - 1))}`}
              hrefFor={(item) => (item === "week" ? "/quiz/leaderboard" : `/quiz/leaderboard?period=${item}`)}
              footer={
                session ? (
                  <p
                    role="status"
                    data-testid="your-rank"
                    className="mx-4.25 mt-3 rounded-md bg-brand-soft p-3 text-sm font-bold text-ink"
                  >
                    {board.you ? text.yourRank(board.you.rank) : text.notRanked}
                  </p>
                ) : null
              }
            />
            <div className="mt-6 flex flex-wrap gap-3 max-sm:*:w-full">
              <Link href="/quiz" className={buttonClasses({ className: "max-sm:w-full" })}>
                {text.play}
                <ButtonArrow />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
