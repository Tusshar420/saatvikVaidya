import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { QuizChallenge } from "@/components/site/quiz/quiz-challenge";
import { SideLeaderboard } from "@/components/site/quiz/side-leaderboard";
import { quiz as copy } from "@/content/quiz";
import { getSession } from "@/server/auth/session";
import { getSetting } from "@/server/content/settings";
import { getQuizPage, readLeaderboard } from "@/server/quiz/view";
import { boardOf, quizIdOf } from "../params";

export const metadata: Metadata = { title: copy.metaTitle };

/**
 * One quiz, opened from its box on /quiz. Anyone can read about it; starting
 * needs an account. The page is made from the server's own view of the
 * attempt, so a refresh resumes it (or shows the result once it is finished).
 */
export default async function QuizDetailPage({ params, searchParams }: PageProps<"/quiz/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const quizId = quizIdOf(id);
  if (quizId === null) notFound();
  const session = await getSession();
  const userId = session?.user.id ?? null;
  const [view, rules, board] = await Promise.all([
    getQuizPage(userId, quizId),
    getSetting("coins.rules"),
    readLeaderboard(boardOf(query.board), userId),
  ]);
  if (!view) notFound();

  return (
    <div className="bg-cream pt-5 pb-19 sm:pt-7 md:pt-9 md:pb-24">
      <div className="shell">
        <Link
          href="/quiz"
          className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-brand hover:underline"
        >
          <ChevronLeft aria-hidden className="size-4.5" />
          {copy.back}
        </Link>
        <div className="mt-2 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <QuizChallenge view={view} signedIn={session !== null} rules={rules} />
          </div>
          <SideLeaderboard board={board} path={`/quiz/${quizId}`} />
        </div>
      </div>
    </div>
  );
}
