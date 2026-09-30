"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { admin as copy } from "@/content/admin";
import { cn } from "@/lib/cn";
import { idleForm, type FormState } from "@/server/admin/form";
import {
  CheckboxField,
  FormActions,
  FormError,
  FormSection,
  TextAreaField,
  TextField,
  useFormValues,
  type FieldValues,
} from "./form-fields";

const text = copy.quiz;
const form = text.form;

// Kept in sync with src/server/admin/quiz.ts (which re-checks everything).
const MAX_QUESTIONS = 50;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

export type QuestionDraft = {
  prompt: string;
  points: number;
  options: string[];
  correct: number;
};

const blankQuestion = (): QuestionDraft => ({
  prompt: "",
  points: 10,
  options: ["", ""],
  correct: 0,
});

export type QuizBuilderProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: FieldValues;
  initialQuestions: QuestionDraft[];
  mode: "new" | "edit";
};

/**
 * Title and description, then a list of questions: each with its points,
 * 2 to 6 options and one correct answer. Questions can be moved up and down.
 * The list is sent as JSON in one hidden field.
 */
export function QuizBuilder({
  action,
  initial,
  initialQuestions,
  mode,
}: QuizBuilderProps) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const values = useFormValues(initial, state);
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    initialQuestions.length ? initialQuestions : [blankQuestion()],
  );

  const update = (index: number, change: Partial<QuestionDraft>) =>
    setQuestions((list) =>
      list.map((question, i) =>
        i === index ? { ...question, ...change } : question,
      ),
    );
  const move = (index: number, by: -1 | 1) =>
    setQuestions((list) => {
      const next = [...list];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });

  const total = questions.reduce(
    (sum, question) => sum + (Number(question.points) || 0),
    0,
  );
  const questionsError = state.fieldErrors?.questions;

  return (
    <form action={formAction} noValidate className="mt-6 flex flex-col gap-5">
      <FormError state={state} />
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />
      <FormSection title={form.detailsTitle}>
        <TextField
          name="title"
          label={form.title}
          values={values}
          maxLength={160}
          required
          className="sm:col-span-2"
        />
        <TextAreaField
          name="description"
          label={form.description}
          values={values}
          maxLength={600}
          optional
          className="sm:col-span-2"
        />
        <CheckboxField
          name="active"
          label={form.active}
          help={form.activeHelp}
          values={values}
          className="sm:col-span-2"
        />
      </FormSection>

      <section aria-labelledby="quiz-questions" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="quiz-questions" className="text-h3 text-ink">
            {form.questionsTitle}
          </h2>
          <p aria-live="polite" className="text-small font-semibold text-muted">
            {form.totalPoints(total)}
          </p>
        </div>
        {questionsError && (
          <p role="alert" className="text-small font-medium text-danger">
            {questionsError}
          </p>
        )}
        <ol className="flex flex-col gap-4">
          {questions.map((question, index) => (
            <QuestionCard
              key={index}
              index={index}
              count={questions.length}
              question={question}
              error={questionError(state, index)}
              onChange={(change) => update(index, change)}
              onMove={(by) => move(index, by)}
              onRemove={() =>
                setQuestions((list) => list.filter((_, i) => i !== index))
              }
            />
          ))}
        </ol>
        <Button
          variant="secondary"
          icon={<Plus aria-hidden className="size-4" />}
          disabled={questions.length >= MAX_QUESTIONS}
          onClick={() => setQuestions((list) => [...list, blankQuestion()])}
          className="self-start max-sm:w-full"
        >
          {form.addQuestion}
        </Button>
      </section>

      <FormActions
        submitLabel={mode === "new" ? text.add : copy.common.save}
        cancelHref="/admin/content/quiz"
        pending={pending}
      />
    </form>
  );
}

/** The first error for question `index`, from paths like "questions.2.options". */
function questionError(state: FormState, index: number): string | undefined {
  const prefix = `questions.${index}.`;
  const entry = Object.entries(state.fieldErrors ?? {}).find(([path]) =>
    path.startsWith(prefix),
  );
  return entry?.[1];
}

function QuestionCard({
  index,
  count,
  question,
  error,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  question: QuestionDraft;
  error?: string;
  onChange: (change: Partial<QuestionDraft>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  const id = `question-${index}`;
  const setOption = (optionIndex: number, value: string) =>
    onChange({
      options: question.options.map((option, i) =>
        i === optionIndex ? value : option,
      ),
    });
  const removeOption = (optionIndex: number) =>
    onChange({
      options: question.options.filter((_, i) => i !== optionIndex),
      correct:
        question.correct === optionIndex
          ? 0
          : question.correct > optionIndex
            ? question.correct - 1
            : question.correct,
    });

  return (
    <li
      aria-labelledby={`${id}-title`}
      className={cn(
        "rounded-xl border bg-surface p-4 shadow-card sm:p-5",
        error ? "border-danger" : "border-line",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${id}-title`} className="text-base font-extrabold text-ink">
          {form.question(n)}
        </h3>
        <div className="flex gap-1">
          <IconButton
            label={form.moveUp(n)}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp aria-hidden />
          </IconButton>
          <IconButton
            label={form.moveDown(n)}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown aria-hidden />
          </IconButton>
          <IconButton
            label={form.removeQuestion(n)}
            disabled={count === 1}
            onClick={onRemove}
            className="text-danger"
          >
            <Trash2 aria-hidden />
          </IconButton>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-small font-medium text-danger">
          {error}
        </p>
      )}

      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_120px]">
        <div className="flex flex-col">
          <label
            htmlFor={`${id}-prompt`}
            className="mb-1.5 text-xs font-extrabold text-ink"
          >
            {form.prompt}
          </label>
          <textarea
            id={`${id}-prompt`}
            value={question.prompt}
            onChange={(event) => onChange({ prompt: event.target.value })}
            maxLength={400}
            rows={2}
            className={cn(inputClasses, "h-auto py-3 leading-normal")}
          />
        </div>
        <div className="flex flex-col">
          <label
            htmlFor={`${id}-points`}
            className="mb-1.5 text-xs font-extrabold text-ink"
          >
            {form.points}
          </label>
          <input
            id={`${id}-points`}
            type="number"
            inputMode="numeric"
            min={0}
            max={1000}
            step={1}
            value={question.points}
            onChange={(event) =>
              onChange({ points: Number.parseInt(event.target.value, 10) || 0 })
            }
            className={inputClasses}
          />
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-xs font-extrabold text-ink">
          {form.options}
          <span className="ml-1.5 font-medium text-muted">
            ({form.correct})
          </span>
        </legend>
        <ul className="flex flex-col gap-2">
          {question.options.map((option, optionIndex) => (
            <li key={optionIndex} className="flex items-center gap-2">
              <label className="grid size-11 shrink-0 cursor-pointer place-items-center">
                <input
                  type="radio"
                  name={`${id}-correct`}
                  checked={question.correct === optionIndex}
                  onChange={() => onChange({ correct: optionIndex })}
                  aria-label={form.correctFor(optionIndex + 1)}
                  className="size-5 cursor-pointer accent-teal"
                />
              </label>
              <input
                value={option}
                onChange={(event) => setOption(optionIndex, event.target.value)}
                maxLength={200}
                aria-label={`${form.question(n)}: ${form.option(optionIndex + 1)}`}
                placeholder={form.option(optionIndex + 1)}
                className={inputClasses}
              />
              <IconButton
                label={form.removeOption(optionIndex + 1)}
                disabled={question.options.length <= MIN_OPTIONS}
                onClick={() => removeOption(optionIndex)}
              >
                <Trash2 aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
        <Button
          variant="link"
          size="sm"
          icon={<Plus aria-hidden className="size-4" />}
          disabled={question.options.length >= MAX_OPTIONS}
          onClick={() => onChange({ options: [...question.options, ""] })}
          className="mt-2"
        >
          {form.addOption}
        </Button>
      </fieldset>
    </li>
  );
}
