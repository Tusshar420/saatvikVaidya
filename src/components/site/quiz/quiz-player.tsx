"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAnswerAction, submitQuizAction } from "@/app/(site)/quiz/actions";
import { Button } from "@/components/ui/button";
import { clock, quiz as copy } from "@/content/quiz";
import { cn } from "@/lib/cn";
import type { PlayQuestion } from "@/server/quiz/view";

const text = copy.play;

type QuizPlayerProps = {
  quizId: number;
  questions: PlayQuestion[];
  /** Question id to chosen option id, as already saved on the server. */
  initialAnswers: Record<string, number>;
  /** Time left by the server's clock when the page was made. */
  secondsLeft: number;
};

/**
 * All the questions on one page. Each choice is saved to the server at once, so
 * a refresh resumes where the player was; the countdown is only a display
 * (the server decides what is late). At zero it submits by itself.
 */
export function QuizPlayer({ quizId, questions, initialAnswers, secondsLeft }: QuizPlayerProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState(initialAnswers);
  const [left, setLeft] = useState(secondsLeft);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const endsAt = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const finishing = useRef(false);

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    setSubmitting(true);
    await queue.current;
    await submitQuizAction(quizId);
    router.refresh();
  }, [quizId, router]);

  useEffect(() => {
    endsAt.current = Date.now() + secondsLeft * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) void finish();
    };
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [secondsLeft, finish]);

  const choose = (questionId: number, optionId: number) => {
    if (finishing.current) return;
    setError(null);
    setAnswers((current) => ({ ...current, [String(questionId)]: optionId }));
    // One save at a time, in the order they were chosen.
    queue.current = queue.current.then(async () => {
      try {
        const result = await saveAnswerAction(quizId, questionId, optionId);
        if (result.status === "expired" || result.status === "finished") router.refresh();
        else if (result.status !== "saved") setError(text.saveError);
      } catch {
        setError(text.saveError);
      }
    });
  };

  const answered = questions.filter((question) => answers[String(question.id)] !== undefined).length;
  const unanswered = questions.length - answered;
  const low = left <= 30;

  return (
    <div>
      <div className="sticky top-18 z-10 -mx-5 -mt-5 bg-surface px-5 pt-5 max-sm:rounded-t-lg sm:-mx-7.5 sm:-mt-7.5 sm:rounded-t-xl sm:px-7.5 sm:pt-7.5 md:top-22">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-heading text-label text-orange-ink uppercase">{copy.challenge}</p>
            <p className="mt-1 text-small font-bold text-muted">{text.answered(answered, questions.length)}</p>
          </div>
          <p
            role="timer"
            aria-label={text.timerLabel(clock(left))}
            className={cn(
              "shrink-0 rounded-[9px] px-2.5 py-2 font-heading text-sm font-extrabold tabular-nums",
              low ? "bg-danger-soft text-danger" : "bg-gold-soft text-gold-ink",
            )}
          >
            <span aria-hidden>{clock(left)}</span>
          </p>
        </div>
        <div aria-hidden className="mt-5 h-1.5 overflow-hidden rounded-full bg-track">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-300"
            style={{ width: `${questions.length ? (answered / questions.length) * 100 : 0}%` }}
          />
        </div>
        <div className="h-6.5" />
      </div>

      {left === 0 && (
        <p role="status" className="mb-4 rounded-md bg-gold-soft p-4 text-sm font-semibold text-gold-ink">
          {text.timeUp}
        </p>
      )}

      <ol className="flex flex-col gap-8">
        {questions.map((question, index) => (
          <li key={question.id}>
            <fieldset disabled={submitting || left === 0} className="min-w-0">
              <legend className="sr-only">{text.question(index + 1, questions.length)}</legend>
              <p aria-hidden className="text-small text-muted uppercase">
                {text.question(index + 1, questions.length)} · {text.points(question.points)}
              </p>
              <p className="mt-2 mb-5 font-heading text-[20px] leading-[1.35] font-extrabold tracking-[-0.025em] break-words text-ink sm:text-[24px]">
                {question.prompt}
              </p>
              <div className="flex flex-col gap-2.25">
                {question.options.map((option, optionIndex) => {
                  const selected = answers[String(question.id)] === option.id;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex min-h-13 cursor-pointer items-center gap-3 rounded-md border px-3.25 py-2.5 text-sm font-bold transition",
                        selected
                          ? "border-brand bg-brand-soft text-ink"
                          : "border-line text-ink/80 hover:border-brand hover:bg-brand-soft/60",
                      )}
                    >
                      <span className="relative grid size-7 shrink-0 place-items-center">
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          checked={selected}
                          onChange={() => choose(question.id, option.id)}
                          className="peer size-7 cursor-pointer appearance-none rounded-sm bg-surface-alt ring-1 ring-line transition checked:bg-brand checked:ring-brand"
                        />
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 grid place-items-center font-heading text-small font-extrabold text-muted peer-checked:text-white"
                        >
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                      </span>
                      <span className="min-w-0 break-words">{option.text}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div role="status" aria-live="polite" className="empty:hidden">
            {error && <p className="text-small font-medium text-danger">{error}</p>}
          </div>
          {unanswered > 0 && <p className="text-small text-muted">{text.unanswered(unanswered)}</p>}
        </div>
        <Button loading={submitting} onClick={() => void finish()} arrow={!submitting} className="w-full shrink-0 sm:w-auto">
          {submitting ? text.submitting : text.submit}
        </Button>
      </div>
    </div>
  );
}
