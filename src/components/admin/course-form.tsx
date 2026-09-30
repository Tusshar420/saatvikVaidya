"use client";

import { useActionState } from "react";
import { admin as copy } from "@/content/admin";
import { idleForm, type FormState } from "@/server/admin/form";
import { KeyField, PlacementFields } from "./content-fields";
import {
  FormActions,
  FormError,
  FormSection,
  TextAreaField,
  TextField,
  useFormValues,
  type FieldValues,
} from "./form-fields";

const text = copy.courses;
const form = text.form;

export type CourseFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: FieldValues;
  mode: "new" | "edit";
};

export function CourseForm({ action, initial, mode }: CourseFormProps) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const values = useFormValues(initial, state);
  return (
    <form action={formAction} noValidate className="mt-6 flex flex-col gap-5">
      <FormError state={state} />
      <FormSection title={form.sections.basics}>
        <KeyField mode={mode} values={values} />
        <TextField
          name="title"
          label={form.title}
          values={values}
          maxLength={160}
          required
          className="sm:col-span-2"
        />
        <TextAreaField
          name="body"
          label={form.body}
          values={values}
          maxLength={300}
          required
          className="sm:col-span-2"
        />
        <TextField
          name="instructor"
          label={form.instructor}
          values={values}
          maxLength={80}
          optional
        />
        <TextField
          name="duration"
          label={form.duration}
          help={form.durationHelp}
          values={values}
          maxLength={40}
          optional
        />
        <TextField
          name="videoUrl"
          type="url"
          label={form.videoUrl}
          help={form.videoUrlHelp}
          values={values}
          maxLength={300}
          optional
          className="sm:col-span-2"
        />
      </FormSection>
      <FormSection title={form.sections.card}>
        <TextField
          name="tag"
          label={form.tag}
          help={form.tagHelp}
          values={values}
          maxLength={60}
          required
          className="sm:col-span-2"
        />
        <TextField
          name="metaLabel"
          label={form.metaLabel}
          help={form.metaLabelHelp}
          values={values}
          maxLength={40}
          required
        />
        <TextField
          name="metaValue"
          label={form.metaValue}
          help={form.metaValueHelp}
          values={values}
          maxLength={80}
          required
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
        cancelHref="/admin/content/courses"
        pending={pending}
      />
    </form>
  );
}
