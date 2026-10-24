"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inputClasses } from "@/components/ui/field";
import { idleForm } from "@/server/admin/form";
import { threadKinds, threadLimits } from "@/lib/threads";
import { threads as copy } from "@/content/threads";
import { createThreadAction, replyAction } from "@/app/(site)/doctor-talk/actions";

const textareaClasses = `${inputClasses} h-auto min-h-28 resize-y py-3`;

/** "Start a thread": a button that opens the new-thread form. */
export function ThreadComposer() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createThreadAction, idleForm);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

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
