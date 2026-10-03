"use client";

import { useActionState } from "react";
import { admin as copy } from "@/content/admin";
import { idleForm, type FormState } from "@/server/admin/form";
import { KeyField, PlacementFields, toneOptions } from "./content-fields";
import {
  CheckboxField,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  TextAreaField,
  TextField,
  useFormValues,
  type FieldValues,
} from "./form-fields";

const text = copy.brands;
const form = text.form;

export type BrandFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: FieldValues;
  mode: "new" | "edit";
};

export function BrandForm({ action, initial, mode }: BrandFormProps) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const values = useFormValues(initial, state);
  return (
    <form action={formAction} noValidate className="mt-6 flex flex-col gap-5">
      <FormError state={state} />
      <FormSection title={form.sections.basics}>
        <KeyField mode={mode} values={values} />
        <TextField
          name="name"
          label={form.name}
          values={values}
          maxLength={80}
          required
        />
        <TextField
          name="monogram"
          label={form.monogram}
          help={form.monogramHelp}
          values={values}
          maxLength={4}
          required
        />
        <TextField
          name="logoSrc"
          label={form.logoSrc}
          help={form.logoSrcHelp}
          values={values}
          maxLength={200}
          optional
        />
        <SelectField
          name="tone"
          label={copy.common.tone}
          values={values}
          options={toneOptions}
        />
        <TextField
          name="eyebrow"
          label={form.eyebrow}
          help={form.eyebrowHelp}
          values={values}
          maxLength={80}
          required
          className="sm:col-span-2"
        />
        <TextAreaField
          name="description"
          label={form.description}
          values={values}
          maxLength={300}
          required
          className="sm:col-span-2"
        />
        <CheckboxField
          name="isPartner"
          label={form.isPartner}
          values={values}
          className="sm:col-span-2"
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
        <CheckboxField
          name="featured"
          label={form.featured}
          values={values}
          className="sm:col-span-2"
        />
      </FormSection>
      <FormActions
        submitLabel={mode === "new" ? text.add : copy.common.save}
        cancelHref="/admin/content/brands"
        pending={pending}
      />
    </form>
  );
}
