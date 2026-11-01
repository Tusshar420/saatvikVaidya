"use client";

import { useActionState, useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, inputClasses, useFieldIds } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { idleForm } from "@/server/admin/form";
import { pollLimits, threadImageUpload, threadKinds, threadLimits } from "@/lib/threads";
import { threads as copy } from "@/content/threads";
import { replyAction } from "@/app/(site)/doctor-talk/actions";

const textareaClasses = `${inputClasses} h-auto min-h-28 resize-y py-3`;
const imageAccept = Object.keys(threadImageUpload.types).join(",");
const imagesHint = copy.form.imagesHint(threadImageUpload.maxCount, threadImageUpload.maxBytes);

type ChosenImage = { file: File; url: string };

/** The errors with the images message set, or cleared when `message` is undefined. */
function imagesError(errors: Record<string, string>, message: string | undefined): Record<string, string> {
  const next = { ...errors };
  if (message) next.images = message;
  else delete next.images;
  return next;
}

/** "Start a thread": a button that opens the new-thread form. */
export function ThreadComposer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [choices, setChoices] = useState<number>(pollLimits.min);
  const [images, setImages] = useState<ChosenImage[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageIds = useFieldIds(undefined, { help: imagesHint, error: errors.images });

  // Free the preview URLs when images are removed or the form goes away.
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url)), []);

  const addImages = (files: File[]) => {
    let error: string | undefined;
    const accepted: ChosenImage[] = [];
    for (const file of files) {
      if (!(file.type in threadImageUpload.types)) error = copy.errors.imageType;
      else if (file.size > threadImageUpload.maxBytes) error = copy.errors.imageTooLarge;
      else if (images.length + accepted.length >= threadImageUpload.maxCount) error = copy.errors.imageCount;
      else accepted.push({ file, url: URL.createObjectURL(file) });
    }
    setImages((current) => [...current, ...accepted]);
    setErrors((current) => imagesError(current, error));
  };

  const removeImage = (index: number) => {
    const image = images[index];
    if (image) URL.revokeObjectURL(image.url);
    setImages((current) => current.filter((_, i) => i !== index));
    setErrors((current) => imagesError(current, undefined));
    fileInput.current?.focus();
  };

  // A pasted image (a screenshot, or one copied from another app) is added
  // to the images; pasted text and links go into Details as usual.
  const pasteImages = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;
    if (!event.clipboardData.getData("text/plain")) event.preventDefault();
    addImages(files);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.delete("images");
    for (const image of images) form.append("images", image.file);
    setFormError(null);
    setPending(true);
    try {
      const response = await fetch("/api/threads", { method: "POST", body: form });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        id?: number;
        message?: string;
        fieldErrors?: Record<string, string>;
      } | null;
      if (response.ok && result?.ok && result.id) {
        router.push(`/doctor-talk/${result.id}`);
        return;
      }
      setErrors(result?.fieldErrors ?? {});
      if (!result?.fieldErrors) setFormError(result?.message ?? copy.errors.generic);
    } catch {
      setFormError(copy.errors.network);
    }
    setPending(false);
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} aria-expanded={false}>
        {copy.ask}
      </Button>
    );
  }
  return (
    <form
      onSubmit={submit}
      aria-label={copy.ask}
      className="mb-5 grid w-full min-w-0 gap-4 rounded-xl border border-line bg-surface p-5 shadow-card"
    >
      <div className="grid gap-1.5">
        <label htmlFor="thread-kind" className="text-xs font-extrabold text-ink">
          {copy.form.kind}
        </label>
        <select id="thread-kind" name="kind" defaultValue="question" className={inputClasses}>
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
          maxLength={threadLimits.body}
          rows={6}
          required
          onPaste={pasteImages}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby="thread-body-help"
          className={textareaClasses}
        />
        <p id="thread-body-help" className="text-xs text-muted">
          {errors.body ? <span className="font-bold text-danger">{errors.body}</span> : copy.form.bodyHint}
        </p>
      </div>
      <Field ids={imageIds} label={copy.form.images} help={imagesHint} error={errors.images}>
        <input
          ref={fileInput}
          id={imageIds.inputId}
          type="file"
          accept={imageAccept}
          multiple
          disabled={images.length >= threadImageUpload.maxCount}
          onChange={(event) => {
            addImages(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
          aria-invalid={errors.images ? true : undefined}
          aria-describedby={imageIds.describedBy}
          className="min-h-11 w-full min-w-0 cursor-pointer rounded-md border border-dashed border-line bg-surface-alt p-1.5 text-sm text-muted file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-sm file:border-0 file:bg-brand-soft file:px-3 file:text-sm file:font-bold file:text-brand disabled:cursor-not-allowed disabled:opacity-60"
        />
        {images.length > 0 && (
          <ul className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {images.map((image, index) => (
              <li key={image.url} className="relative aspect-square overflow-hidden rounded-md border border-line bg-surface-alt">
                {/* A local preview (blob: URL), so next/image doesn't apply. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={copy.form.imagePreview(index + 1)} className="size-full object-cover" />
                <IconButton
                  label={copy.form.removeImage(index + 1)}
                  variant="outline"
                  shape="round"
                  onClick={() => removeImage(index)}
                  className="absolute top-1.5 right-1.5"
                >
                  <X aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Field>
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
      {formError && (
        <p role="alert" className="text-small font-bold text-danger">
          {formError}
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
