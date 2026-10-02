import type { Metadata } from "next";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { QuizPlayer } from "@/components/site/quiz/quiz-player";
import { Eyebrow } from "@/components/ui/badge";
import { Button, ButtonArrow, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { clock, quiz as copy } from "@/content/quiz";
import { signInPath } from "@/lib/auth-routes";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { QUIZ_SECONDS } from "@/lib/quiz";
import { getSession } from "@/server/auth/session";
import { getSetting } from "@/server/content/settings";
import { getQuizPage } from "@/server/quiz/view";
import { startQuizAction } from "./actions";

export const metadata: Metadata = { title: copy.metaTitle };

/**
 * Quiz & Win (P2.3). Anyone can read about the open quiz; starting needs an
 * account. The page is made from the server's own view of the attempt, so a
 * refresh resumes it (or shows the result once it is finished).
 */
export default async function QuizPage() {
  const session = await getSession();
  const [view, rules] = await Promise.all([getQuizPage(session?.user.id ?? null), getSetting("coins.rules")]);

  return (
    <div className="shell section-y">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>{copy.eyebrow}</Eyebrow>

        {view.state === "none" && (
          <>
            <h1 className="mt-2 text-h2 text-ink">{copy.title}</h1>
            <EmptyState
              as="h2"
              className="mt-6"
              title={copy.none.title}
              description={
                view.next ? copy.none.next(formatDateTime(view.next.startsAt)) : copy.none.noneScheduled
              }
              action={
                <Link href="/quiz/leaderboard" className={buttonClasses({ variant: "secondary" })}>
                  {copy.home.leaderboard}
                </Link>
              }
            />
          </>
        )}

        {view.state === "ready" && (
          <>
            <h1 className="mt-2 text-h2 text-ink">{view.quiz.title}</h1>
            {view.quiz.description && <p className="mt-2 text-muted">{view.quiz.description}</p>}
            <div className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6">
              <p className="text-label text-orange-ink uppercase">
                {copy.facts(view.quiz.questionCount, QUIZ_SECONDS / 60)}
              </p>
              <p className="mt-1 text-small text-muted">{copy.endsOn(formatDateTime(view.quiz.endsAt))}</p>
              <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-sm text-ink">
                {copy.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
                {rules.enabled && rules.quizReward > 0 && (
                  <li>{copy.coinsLine(rules.quizReward, view.passPercent)}</li>
                )}
              </ul>
              <div className="mt-6">
                {session ? (
                  <form action={startQuizAction}>
                    <input type="hidden" name="quizId" value={view.quiz.id} />
                    <Button type="submit" arrow className="w-full sm:w-auto">
                      {copy.start}
                    </Button>
                  </form>
                ) : (
                  <>
                    <p className="mb-3 text-small text-muted">{copy.signInNote}</p>
                    <Link href={signInPath("/quiz")} className={buttonClasses({ className: "max-sm:w-full" })}>
                      {copy.signIn}
                      <ButtonArrow />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {view.state === "playing" && (
          <>
            <h1 className="mt-2 mb-6 text-h2 text-ink">{view.quiz.title}</h1>
            <QuizPlayer
              quizId={view.quiz.id}
              questions={view.questions}
              initialAnswers={view.answers}
              secondsLeft={view.secondsLeft}
            />
          </>
        )}

        {view.state === "finished" && (
          <>
            <h1 className="mt-2 text-h2 text-ink">{view.quiz.title}</h1>
            <section
              aria-labelledby="quiz-result"
              className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
            >
              <h2 id="quiz-result" className="text-h3 text-ink">
                {copy.result.title}
              </h2>
              <p className="mt-2 text-h2 text-teal">{copy.result.score(view.result.score, view.result.maxScore)}</p>
              <p className="mt-1 text-sm text-muted">
                {copy.result.correct(view.result.correctCount, view.review.length)} ·{" "}
                {copy.result.time(clock(view.result.timeTakenSeconds))}
              </p>
              <p role="status" className="mt-4 rounded-lg bg-teal-soft p-3 text-sm font-semibold text-ink">
                {view.result.coinsAwarded > 0
                  ? copy.result.earned(view.result.coinsAwarded)
                  : copy.result.notEarned(view.passPercent)}
              </p>
              <div className="mt-5 flex flex-wrap gap-3 max-sm:*:w-full">
                <Link href="/quiz/leaderboard" className={buttonClasses()}>
                  {copy.result.leaderboard}
                  <ButtonArrow />
                </Link>
                {view.result.coinsAwarded > 0 && (
                  <Link href="/coins" className={buttonClasses({ variant: "secondary" })}>
                    {copy.result.coins}
                  </Link>
                )}
              </div>
            </section>

            <h2 className="mt-8 text-h3 text-ink">{copy.result.review}</h2>
            <ol className="mt-4 flex flex-col gap-4">
              {view.review.map((question, index) => {
                const right = question.chosenOptionId !== null && question.chosenOptionId === question.correctOptionId;
                return (
                  <li
                    key={question.id}
                    data-testid="quiz-review"
                    className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5"
                  >
                    <p className="text-label text-muted uppercase">
                      {index + 1}. {right ? copy.result.right : copy.result.wrong}
                    </p>
                    <p className="mt-1 font-bold text-ink">{question.prompt}</p>
                    <ul className="mt-3 flex flex-col gap-2">
                      {question.options.map((option) => {
                        const isCorrect = option.id === question.correctOptionId;
                        const isChosen = option.id === question.chosenOptionId;
                        return (
                          <li
                            key={option.id}
                            className={cn(
                              "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                              isCorrect
                                ? "border-teal bg-teal-soft font-bold text-ink"
                                : isChosen
                                  ? "border-danger bg-danger-soft text-ink"
                                  : "border-line text-muted",
                            )}
                          >
                            {isCorrect ? (
                              <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
                            ) : isChosen ? (
                              <X aria-hidden className="mt-0.5 size-4 shrink-0" />
                            ) : (
                              <span aria-hidden className="size-4 shrink-0" />
                            )}
                            <span className="min-w-0 break-words">
                              {option.text}
                              {isCorrect && <span className="sr-only"> ({copy.result.correctAnswer})</span>}
                              {isChosen && <span className="sr-only"> ({copy.result.yourAnswer})</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {question.chosenOptionId === null && (
                      <p className="mt-2 text-small text-muted">{copy.result.noAnswer}</p>
                    )}
                    {question.explanation && <p className="mt-3 text-sm text-ink">{question.explanation}</p>}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
