"use client";

import { useActionState } from "react";
import { updateSectionHeadingAction } from "@/app/admin/content/home-actions";
import { adminHome } from "@/content/admin-site";
import { idleForm } from "@/server/admin/form";
import {
  FormActions,
  FormError,
  FormSection,
  TextAreaField,
  TextField,
  useFormValues,
  type FieldValues,
} from "./form-fields";

const fields = adminHome.sections.fields;

/** The heading copy above a homepage section. */
export function SectionHeadingForm({ sectionKey, initial }: { sectionKey: string; initial: FieldValues }) {
  const [state, action, pending] = useActionState(
    updateSectionHeadingAction.bind(null, sectionKey),
    idleForm,
  );
  const values = useFormValues(initial, state);
  return (
    <form action={action} noValidate className="mt-6 flex max-w-4xl flex-col gap-5">
      <FormError state={state} />
      <FormSection title={adminHome.sections.editTitle(adminHome.sections.labels[sectionKey] ?? sectionKey)}>
        <TextField name="eyebrow" label={fields.eyebrow} values={values} maxLength={80} optional />
        <TextField name="title" label={fields.title} values={values} maxLength={160} optional />
        <TextField
          name="titleEmphasis"
          label={fields.titleEmphasis}
          help={fields.titleEmphasisHelp}
          values={values}
          maxLength={160}
          optional
        />
        <TextAreaField
          name="description"
          label={fields.description}
          values={values}
          maxLength={400}
          optional
          className="sm:col-span-2"
        />
        <TextField name="linkLabel" label={fields.linkLabel} values={values} maxLength={80} optional />
        <TextField name="linkHref" label={fields.linkHref} values={values} maxLength={200} optional />
      </FormSection>
      <FormActions submitLabel="Save changes" cancelHref="/admin/content/sections" pending={pending} />
    </form>
  );
}
