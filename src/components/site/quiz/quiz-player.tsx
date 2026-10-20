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
      <div
        className={cn(
          "sticky top-18 z-10 md:top-22 -mx-1 mb-6 flex items-center justify-between gap-3 rounded-lg border bg-surface px-4 py-3 shadow-card",
          low ? "border-danger" : "border-line",
        )}
      >
        <p className="text-small font-bold text-muted">{text.answered(answered, questions.length)}</p>
        <p
          role="timer"
          aria-label={text.timerLabel(clock(left))}
          className={cn("text-h3 tabular-nums", low ? "text-danger" : "text-orange-ink")}
        >
          <span aria-hidden>⏱ {clock(left)}</span>
        </p>
      </div>

      {left === 0 && (
        <p role="status" className="mb-4 rounded-lg bg-gold-soft p-4 text-sm font-semibold text-gold-ink">
          {text.timeUp}
        </p>
      )}

      <ol className="flex flex-col gap-5">
        {questions.map((question, index) => (
          <li key={question.id}>
            <fieldset
              disabled={submitting || left === 0}
              className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-6"
            >
              <legend className="sr-only">{text.question(index + 1, questions.length)}</legend>
              <p className="text-label text-orange-ink uppercase">
                {text.question(index + 1, questions.length)} · {text.points(question.points)}
              </p>
              <p className="mt-2 text-body-lg font-500 text-ink">{question.prompt}</p>
              <div className="mt-4 flex flex-col gap-2">
                {question.options.map((option) => {
                  const selected = answers[String(question.id)] === option.id;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-2.5 text-sm transition",
                        selected ? "border-brand bg-brand-soft font-bold text-ink" : "border-line hover:border-brand",
                      )}
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        checked={selected}
                        onChange={() => choose(question.id, option.id)}
                        className="size-5 shrink-0 cursor-pointer accent-brand"
                      />
                      <span className="min-w-0 break-words">{option.text}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-col gap-3">
        <div role="status" aria-live="polite" className="empty:hidden">
          {error && <p className="text-small font-medium text-danger">{error}</p>}
        </div>
        {unanswered > 0 && <p className="text-small text-muted">{text.unanswered(unanswered)}</p>}
        <Button loading={submitting} onClick={() => void finish()} className="w-full sm:w-auto sm:self-start">
          {submitting ? text.submitting : text.submit}
        </Button>
      </div>
    </div>
  );
}
