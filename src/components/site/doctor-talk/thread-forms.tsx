"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inputClasses } from "@/components/ui/field";
import { idleForm } from "@/server/admin/form";
import { pollLimits, threadKinds, threadLimits } from "@/lib/threads";
import { threads as copy } from "@/content/threads";
import { createThreadAction, replyAction } from "@/app/(site)/doctor-talk/actions";

const textareaClasses = `${inputClasses} h-auto min-h-28 resize-y py-3`;

/** "Start a thread": a button that opens the new-thread form. */
export function ThreadComposer() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createThreadAction, idleForm);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const [pollOpen, setPollOpen] = useState(false);
  const [choices, setChoices] = useState<number>(pollLimits.min);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} aria-expanded={false}>
        {copy.ask}
      </Button>
    );
  }
  return (
    <form
      action={action}
      aria-label={copy.ask}
      className="mb-5 grid w-full min-w-0 gap-4 rounded-xl border border-line bg-surface p-5 shadow-card"
    >
      <div className="grid gap-1.5">
        <label htmlFor="thread-kind" className="text-xs font-extrabold text-ink">
          {copy.form.kind}
        </label>
        <select
          id="thread-kind"
          name="kind"
          defaultValue={values.kind ?? "question"}
          className={inputClasses}
        >
          {threadKinds.map((kind) => (
            <option key={kind} value={kind}>
              {copy.kindLabel[kind]}
            </option>
          ))}
        </select>
        {errors.kind && <p className="text-xs font-bold text-danger">{errors.kind}</p>}
      </div>
      <Input
        name="title"
        label={copy.form.title}
        help={copy.form.titleHint}
        error={errors.title}
        defaultValue={values.title}
        maxLength={threadLimits.title}
        required
      />
      <div className="grid gap-1.5">
        <label htmlFor="thread-body" className="text-xs font-extrabold text-ink">
          {copy.form.body}
        </label>
        <textarea
          id="thread-body"
          name="body"
          defaultValue={values.body}
          maxLength={threadLimits.body}
          rows={6}
          required
          aria-invalid={errors.body ? true : undefined}
          aria-describedby="thread-body-help"
          className={textareaClasses}
        />
        <p id="thread-body-help" className="text-xs text-muted">
          {errors.body ? <span className="font-bold text-danger">{errors.body}</span> : copy.form.bodyHint}
        </p>
      </div>
      {pollOpen ? (
        <fieldset className="grid min-w-0 gap-3 rounded-lg border border-line p-4">
          <legend className="px-1 text-xs font-extrabold text-ink">{copy.poll.legend}</legend>
          <input type="hidden" name="poll" value="on" />
          <p className="text-xs text-muted">{copy.poll.help}</p>
          {Array.from({ length: choices }, (_, i) => (
            <Input
              key={i}
              name={`pollOption${i + 1}`}
              label={copy.poll.option(i + 1)}
              defaultValue={values[`pollOption${i + 1}`]}
              maxLength={pollLimits.option}
              required={i < pollLimits.min}
            />
          ))}
          {errors.pollOptions && (
            <p role="alert" className="text-xs font-bold text-danger">
              {errors.pollOptions}
            </p>
          )}
          <div className="flex flex-wrap gap-2.5">
            {choices < pollLimits.max && (
              <Button variant="secondary" size="sm" onClick={() => setChoices(choices + 1)}>
                {copy.poll.addOption}
              </Button>
            )}
            <Button variant="link" size="sm" onClick={() => setPollOpen(false)}>
              {copy.poll.remove}
            </Button>
          </div>
        </fieldset>
      ) : (
        <div>
          <Button
            variant="secondary"
            size="sm"
            icon={<ListChecks aria-hidden className="size-4" />}
            onClick={() => setPollOpen(true)}
          >
            {copy.poll.add}
          </Button>
        </div>
      )}
      {state.status === "error" && !state.fieldErrors && (
        <p role="alert" className="text-small font-bold text-danger">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" loading={pending}>
          {pending ? copy.form.posting : copy.form.submit}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          {copy.form.cancel}
        </Button>
      </div>
    </form>
  );
}

export function ReplyForm({ threadId }: { threadId: number }) {
  const [state, action, pending] = useActionState(replyAction, idleForm);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);
  const error = state.fieldErrors?.body ?? (state.status === "error" ? state.message : undefined);
  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <input type="hidden" name="threadId" value={threadId} />
      <div className="grid gap-1.5">
        <label htmlFor="reply-body" className="text-xs font-extrabold text-ink">
          {copy.reply.label}
        </label>
        <textarea
          id="reply-body"
          name="body"
          rows={3}
          required
          maxLength={threadLimits.reply}
          placeholder={copy.reply.placeholder}
          aria-invalid={error ? true : undefined}
          className={textareaClasses}
        />
        {error && (
          <p role="alert" className="text-xs font-bold text-danger">
            {error}
          </p>
        )}
      </div>
      <div>
        <Button type="submit" loading={pending}>
          {pending ? copy.reply.posting : copy.reply.submit}
        </Button>
      </div>
    </form>
  );
}
