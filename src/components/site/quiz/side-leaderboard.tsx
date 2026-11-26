import Link from "next/link";
import { LeaderboardCard } from "@/components/site/quiz/leaderboard-card";
import { ButtonArrow } from "@/components/ui/button";
import { quiz as copy } from "@/content/quiz";
import type { Leaderboard } from "@/server/quiz/view";

/**
 * The top-five leaderboard beside the quizzes on /quiz and /quiz/[id], with
 * its This week / This month tabs on `path` and a link to the full board.
 */
export function SideLeaderboard({ board, path }: { board: Leaderboard; path: string }) {
  return (
    <LeaderboardCard
      board={board}
      limit={5}
      hrefFor={(item) => (item === "week" ? path : `${path}?board=${item}`)}
      className="lg:sticky lg:top-28"
      footer={
        <div className="border-b border-line px-4.25 py-3">
          <Link
            href={board.period === "week" ? "/quiz/leaderboard" : "/quiz/leaderboard?period=month"}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-brand hover:underline"
          >
            {copy.board.full}
            <ButtonArrow />
          </Link>
        </div>
      }
    />
  );
}
