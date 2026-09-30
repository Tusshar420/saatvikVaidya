"use client";

import { useActionState, useState } from "react";
import { Play } from "lucide-react";
import { admin as copy } from "@/content/admin";
import { idleForm, type FormState } from "@/server/admin/form";
import {
  FormActions,
  FormError,
  FormSection,
  SelectField,
  TextAreaField,
  TextField,
  useFormValues,
  type FieldValues,
} from "./form-fields";
import { KeyField, PlacementFields, toneOptions } from "./content-fields";

const text = copy.reels;
const form = text.form;

type Preview = {
  mediaKind: string;
  mediaSrc: string;
  posterSrc: string;
  mediaLabel: string;
  title: string;
  posterText: string;
  badge: string;
};

export type ReelFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: FieldValues;
  mode: "new" | "edit";
};

export function ReelForm({ action, initial, mode }: ReelFormProps) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const values = useFormValues(initial, state);
  const read = (): Preview => ({
    mediaKind: values.text("mediaKind"),
    mediaSrc: values.text("mediaSrc"),
    posterSrc: values.text("posterSrc"),
    mediaLabel: values.text("mediaLabel"),
    title: values.text("title"),
    posterText: values.text("posterText"),
    badge: values.text("badge"),
  });
  const [preview, setPreview] = useState<Preview>(read);

  return (
    <form
      action={formAction}
      noValidate
      className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px] lg:items-start"
      onChange={(event) => {
        const data = new FormData(event.currentTarget);
        setPreview({
          mediaKind: String(data.get("mediaKind") ?? ""),
          mediaSrc: String(data.get("mediaSrc") ?? ""),
          posterSrc: String(data.get("posterSrc") ?? ""),
          mediaLabel: String(data.get("mediaLabel") ?? ""),
          title: String(data.get("title") ?? ""),
          posterText: String(data.get("posterText") ?? ""),
          badge: String(data.get("badge") ?? ""),
        });
      }}
    >
      <div className="flex flex-col gap-5">
        <FormError state={state} />
        <FormSection title={form.sections.basics}>
          <KeyField mode={mode} values={values} />
          <TextField
            name="title"
            label={form.title}
            help={form.titleHelp}
            values={values}
            maxLength={200}
            required
            className="sm:col-span-2"
          />
          <SelectField
            name="mediaKind"
            label={form.mediaKind}
            values={values}
            options={(["VIDEO", "IMAGE", "POSTER"] as const).map((kind) => ({
              value: kind,
              label: text.mediaKinds[kind],
            }))}
          />
          <SelectField
            name="type"
            label={form.type}
            help={form.typeHelp}
            values={values}
            options={(["PRODUCT", "FEEDBACK", "LEARNING", "OFFER"] as const).map(
              (type) => ({ value: type, label: text.types[type] }),
            )}
          />
        </FormSection>

        <FormSection title={form.sections.media}>
          <TextField
            name="mediaSrc"
            label={form.mediaSrc}
            help={form.mediaSrcHelp}
            values={values}
            maxLength={200}
            className="sm:col-span-2"
          />
          <TextField
            name="posterSrc"
            label={form.posterSrc}
            help={form.posterSrcHelp}
            values={values}
            maxLength={200}
            optional
          />
          <TextField
            name="mediaLabel"
            label={form.mediaLabel}
            help={form.mediaLabelHelp}
            values={values}
            maxLength={200}
            optional
          />
        </FormSection>

        <FormSection title={form.sections.poster}>
          <TextAreaField
            name="posterText"
            label={form.posterText}
            help={form.posterTextHelp}
            values={values}
            maxLength={200}
            optional
            className="sm:col-span-2"
          />
          <TextField
            name="posterKicker"
            label={form.posterKicker}
            values={values}
            maxLength={80}
            optional
          />
          <TextField
            name="posterByline"
            label={form.posterByline}
            values={values}
            maxLength={80}
            optional
          />
        </FormSection>

        <FormSection title={form.sections.labels}>
          <TextField
            name="badge"
            label={form.badge}
            values={values}
            maxLength={60}
            optional
          />
          <SelectField
            name="badgeTone"
            label={form.badgeTone}
            values={values}
            options={[{ value: "", label: form.noTone }, ...toneOptions]}
          />
          <TextField
            name="metaLabel"
            label={form.metaLabel}
            help={form.metaLabelHelp}
            values={values}
            maxLength={60}
            optional
          />
          <TextField
            name="valueLabel"
            label={form.valueLabel}
            help={form.valueLabelHelp}
            values={values}
            maxLength={60}
            optional
          />
        </FormSection>

        <FormSection title={form.sections.link}>
          <TextField
            name="linkLabel"
            label={copy.common.linkLabel}
            values={values}
            maxLength={80}
            required
          />
          <TextField
            name="linkHref"
            label={copy.common.linkHref}
            help={copy.common.linkHrefHelp}
            values={values}
            maxLength={200}
            optional
          />
        </FormSection>

        <FormSection title={form.sections.placement}>
          <PlacementFields values={values} />
        </FormSection>

        <FormActions
          submitLabel={mode === "new" ? text.add : copy.common.save}
          cancelHref="/admin/content/reels"
          pending={pending}
        />
      </div>

      <ReelPreview preview={preview} />
    </form>
  );
}

/** Rough look of the reel card, from what's typed so far. */
function ReelPreview({ preview }: { preview: Preview }) {
  // Only site paths are previewed, as on the site itself.
  const path = (value: string) =>
    value.startsWith("/") && !value.startsWith("//") ? value : "";
  const media = path(preview.mediaSrc);
  const poster = path(preview.posterSrc);
  return (
    <aside
      aria-label={form.preview}
      className="rounded-xl border border-line bg-surface p-4 shadow-card lg:sticky lg:top-24"
    >
      <h2 className="text-label text-teal uppercase">{form.preview}</h2>
      <div className="relative mt-3 aspect-[4/5] overflow-hidden rounded-lg bg-surface-alt">
        {preview.mediaKind === "POSTER" ? (
          <div className="absolute inset-0 grid place-items-center bg-learning-poster p-5 text-center">
            <p className="font-serif-hindi text-lg leading-snug font-bold whitespace-pre-line text-white">
              {preview.posterText}
            </p>
          </div>
        ) : preview.mediaKind === "VIDEO" && media ? (
          <video
            src={media}
            poster={poster || undefined}
            controls
            preload="metadata"
            aria-label={preview.mediaLabel || preview.title}
            className="size-full object-cover"
          />
        ) : preview.mediaKind === "IMAGE" && media ? (
          // Plain <img>: the path is whatever is typed, not a known asset.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media}
            alt={preview.mediaLabel}
            className="size-full object-cover"
          />
        ) : (
          <p className="absolute inset-0 grid place-items-center p-6 text-center text-small text-muted">
            <span>
              <Play aria-hidden className="mx-auto mb-2 size-6" />
              {form.previewEmpty}
            </span>
          </p>
        )}
        {preview.badge && (
          <span className="absolute top-3 left-3 rounded-sm bg-teal px-2 py-1 text-xs font-bold text-white">
            {preview.badge}
          </span>
        )}
      </div>
      <p className="mt-3 text-sm font-bold text-ink">{preview.title}</p>
    </aside>
  );
}
