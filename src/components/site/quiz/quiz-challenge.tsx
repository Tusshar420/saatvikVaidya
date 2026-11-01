import Link from "next/link";
import { Check, Star, X } from "lucide-react";
import { QuizPlayer } from "@/components/site/quiz/quiz-player";
import { Button, ButtonArrow, buttonClasses } from "@/components/ui/button";
import { clock, quiz as copy } from "@/content/quiz";
import { signInPath } from "@/lib/auth-routes";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { QUIZ_SECONDS } from "@/lib/quiz";
import type { QuizPageView } from "@/server/quiz/view";
import { startQuizAction } from "@/app/(site)/quiz/actions";

const MINUTES = QUIZ_SECONDS / 60;

/** The card head every state shares: "WEEKLY CHALLENGE", the timer pill and the progress bar. */
// Before starting (or with the quiz not open) there is no time to show, so the badge is left out.
function ChallengeHead({ time, progress }: { time?: string; progress: number }) {
  return (
    <>
      <div className="flex min-h-9 items-center justify-between gap-3">
        <p className="font-heading text-label text-orange-ink uppercase">{copy.challenge}</p>
        {time && (
          <p className="rounded-[9px] bg-gold-soft px-2.5 py-2 font-heading text-sm font-extrabold text-gold-ink tabular-nums">
            {time}
          </p>
        )}
      </div>
      <div aria-hidden className="mt-5 mb-6.5 h-1.5 overflow-hidden rounded-full bg-track">
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress}%` }} />
      </div>
    </>
  );
}

export const quizCardClass = "rounded-xl border border-line bg-surface p-5 shadow-card max-sm:rounded-lg sm:p-7.5";
const cardClass = quizCardClass;

type QuizChallengeProps = {
  view: QuizPageView;
  signedIn: boolean;
  /** The quiz coins rule, for the "score 60% to earn" line. */
  rules: { enabled: boolean; quizReward: number };
};

/**
 * One quiz's card on /quiz/[id] (P2.3, v2 look in U.10): ready to start, in
 * play, finished with its answers, or not open (yet / any more). The quiz
 * title is the page's h1.
 */
export function QuizChallenge({ view, signedIn, rules }: QuizChallengeProps) {
  const signInHref = signInPath(`/quiz/${view.quiz.id}`);
  return (
    <>
      {view.state === "upcoming" && (
        <section aria-labelledby="quiz-title" className={cardClass}>
          <ChallengeHead progress={0} />
          <h1 id="quiz-title" className="font-heading text-[20px] leading-[1.35] font-extrabold tracking-[-0.025em] text-ink sm:text-[24px]">
            {view.quiz.title}
          </h1>
          {view.quiz.description && <p className="mt-2 text-body text-muted">{view.quiz.description}</p>}
          <p className="mt-4 rounded-md bg-gold-soft px-4 py-3 text-sm font-semibold text-gold-ink">
            <span className="block font-extrabold">{copy.upcoming.title}</span>
            {copy.upcoming.opens(formatDateTime(view.quiz.startsAt))}
          </p>
        </section>
      )}

      {view.state === "closed" && (
        <section aria-labelledby="quiz-title" className={cardClass}>
          <ChallengeHead progress={100} />
          <h1 id="quiz-title" className="font-heading text-[20px] leading-[1.35] font-extrabold tracking-[-0.025em] text-ink sm:text-[24px]">
            {view.quiz.title}
          </h1>
          <p className="mt-2 text-body text-muted">
            <span className="block font-bold text-ink">{copy.closed.title}</span>
            {copy.closed.body}
          </p>
          <div className="mt-5.5">
            <Link href="/quiz" className={buttonClasses({ className: "max-sm:w-full" })}>
              {copy.closed.cta}
              <ButtonArrow />
            </Link>
          </div>
        </section>
      )}

      {view.state === "ready" && (
        <section aria-labelledby="quiz-title" className={cardClass}>
          <ChallengeHead time={clock(QUIZ_SECONDS)} progress={0} />
          <p className="text-small text-muted uppercase">
            {copy.facts(view.quiz.questionCount, MINUTES)}
          </p>
          <h1
            id="quiz-title"
            className="mt-2 font-heading text-[20px] leading-[1.35] font-extrabold tracking-[-0.025em] text-ink sm:text-[24px]"
          >
            {view.quiz.title}
          </h1>
          {view.quiz.description && <p className="mt-2 text-body text-muted">{view.quiz.description}</p>}
          <p className="mt-1 text-small text-muted">{copy.endsOn(formatDateTime(view.quiz.endsAt))}</p>
          <ul className="mt-5 flex flex-col gap-2.25">
            {copy.rules.map((rule, index) => (
              <li
                key={rule}
                className="flex min-h-13 items-center gap-3 rounded-md border border-line px-3.25 py-2.5 text-sm font-semibold text-ink"
              >
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-sm bg-surface-alt font-heading text-small font-extrabold text-muted"
                >
                  {index + 1}
                </span>
                {rule}
              </li>
            ))}
            {rules.enabled && rules.quizReward > 0 && (
              <li className="flex min-h-13 items-center gap-3 rounded-md border border-brand/30 bg-brand-soft px-3.25 py-2.5 text-sm font-semibold text-ink">
                <Star aria-hidden className="size-7 shrink-0 rounded-sm bg-surface p-1.5 text-brand" />
                {copy.coinsLine(rules.quizReward, view.passPercent)}
              </li>
            )}
          </ul>
          <div className="mt-5.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {signedIn ? (
              <>
                <p className="text-small text-muted">{copy.rules[2]}</p>
                <form action={startQuizAction}>
                  <input type="hidden" name="quizId" value={view.quiz.id} />
                  <Button type="submit" arrow className="w-full sm:w-auto">
                    {copy.start}
                  </Button>
                </form>
              </>
            ) : (
              <>
                <p className="text-small text-muted">{copy.signInNote}</p>
                <Link href={signInHref} className={buttonClasses({ className: "shrink-0 max-sm:w-full" })}>
                  {copy.signIn}
                  <ButtonArrow />
                </Link>
              </>
            )}
          </div>
        </section>
      )}

      {view.state === "playing" && (
        <div className={cardClass}>
          <h1 className="sr-only">{view.quiz.title}</h1>
          <QuizPlayer
            quizId={view.quiz.id}
            questions={view.questions}
            initialAnswers={view.answers}
            secondsLeft={view.secondsLeft}
          />
        </div>
      )}

      {view.state === "finished" && (
        <>
          <section aria-labelledby="quiz-result" className={cardClass}>
            <ChallengeHead time={clock(view.result.timeTakenSeconds)} progress={100} />
            <h1 className="text-center text-small font-bold text-muted uppercase">{view.quiz.title}</h1>
            <div className="px-2 pt-6 pb-4 text-center sm:px-5 sm:pt-8">
              <div className="mx-auto mb-4.5 grid size-18 place-items-center rounded-full bg-success-soft text-success">
                <Star aria-hidden className="size-8.75" />
              </div>
              <h2 id="quiz-result" className="font-heading text-[27px] font-extrabold tracking-[-0.03em] text-ink">
                {copy.result.title}
              </h2>
              <p className="mt-1 font-heading text-h3 text-brand">
                {copy.result.score(view.result.score, view.result.maxScore)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {copy.result.correct(view.result.correctCount, view.review.length)} ·{" "}
                {copy.result.time(clock(view.result.timeTakenSeconds))}
              </p>
              <p
                role="status"
                className="mx-auto mt-4 max-w-117.5 rounded-md bg-brand-soft px-4 py-3 text-sm font-semibold text-ink"
              >
                {view.result.coinsAwarded > 0
                  ? copy.result.earned(view.result.coinsAwarded)
                  : copy.result.notEarned(view.passPercent)}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3 max-sm:*:w-full">
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
            </div>
          </section>

          <section aria-labelledby="quiz-review" className={cn(cardClass, "mt-5")}>
            <h2 id="quiz-review" className="font-heading text-h4 text-ink">
              {copy.result.review}
            </h2>
            <ol className="mt-4 flex flex-col gap-6">
              {view.review.map((question, index) => {
                const right =
                  question.chosenOptionId !== null && question.chosenOptionId === question.correctOptionId;
                return (
                  <li key={question.id} data-testid="quiz-review" className="border-t border-line pt-5 first:border-0 first:pt-0">
                    <p className={cn("text-label uppercase", right ? "text-success" : "text-danger")}>
                      {index + 1}. {right ? copy.result.right : copy.result.wrong}
                    </p>
                    <p className="mt-1.5 font-heading text-h4 text-ink">{question.prompt}</p>
                    <ul className="mt-3 flex flex-col gap-2.25">
                      {question.options.map((option, optionIndex) => {
                        const isCorrect = option.id === question.correctOptionId;
                        const isChosen = option.id === question.chosenOptionId;
                        return (
                          <li
                            key={option.id}
                            className={cn(
                              "flex min-h-13 items-center gap-3 rounded-md border px-3.25 py-2.5 text-sm font-semibold",
                              isCorrect
                                ? "border-brand bg-brand-soft text-ink"
                                : isChosen
                                  ? "border-danger bg-danger-soft text-ink"
                                  : "border-line text-muted",
                            )}
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "grid size-7 shrink-0 place-items-center rounded-sm font-heading text-small font-extrabold",
                                isCorrect
                                  ? "bg-brand text-white"
                                  : isChosen
                                    ? "bg-danger text-white"
                                    : "bg-surface-alt text-muted",
                              )}
                            >
                              {isCorrect ? (
                                <Check className="size-4" />
                              ) : isChosen ? (
                                <X className="size-4" />
                              ) : (
                                String.fromCharCode(65 + optionIndex)
                              )}
                            </span>
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
                    {question.explanation && (
                      <p className="mt-3 rounded-md bg-surface-alt p-3 text-sm text-ink">{question.explanation}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}
    </>
  );
}
