"use client";

import { useActionState } from "react";
import { admin as copy } from "@/content/admin";
import { gstRates } from "@/lib/catalogue";
import { idleForm, type FormState } from "@/server/admin/form";
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

const text = copy.ebooks;
const form = text.form;

export type EbookFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: FieldValues;
  mode: "new" | "edit";
};

/** An ebook's details, price and switches (the files are uploaded separately). */
export function EbookForm({ action, initial, mode }: EbookFormProps) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const values = useFormValues(initial, state);

  return (
    <form action={formAction} noValidate className="mt-6 flex flex-col gap-5">
      <FormError state={state} />

      <FormSection title={form.sections.basics}>
        <TextField name="title" label={form.title} values={values} maxLength={160} required />
        <TextField
          name="slug"
          label={form.slug}
          help={form.slugHelp}
          values={values}
          maxLength={120}
          optional
          autoCapitalize="none"
          spellCheck={false}
        />
        <TextField name="author" label={form.author} values={values} maxLength={120} optional />
        <TextAreaField
          name="description"
          label={form.description}
          help={form.descriptionHelp}
          values={values}
          maxLength={5000}
          rows={5}
          required
          className="sm:col-span-2"
        />
      </FormSection>

      <FormSection title={form.sections.pricing}>
        <div className="sm:col-span-2">
          <CheckboxField name="isFree" label={form.isFree} values={values} />
        </div>
        <TextField
          name="price"
          label={form.price}
          help={form.priceHelp}
          values={values}
          inputMode="decimal"
          maxLength={14}
          optional
        />
        <SelectField
          name="gstRate"
          label={form.gstRate}
          help={form.gstHelp}
          values={values}
          options={gstRates.map((rate) => ({
            value: String(rate),
            label: copy.catalogue.form.gstOption(rate),
          }))}
        />
      </FormSection>

      <FormSection title={form.sections.switches}>
        <TextField
          name="sortOrder"
          label={form.sortOrder}
          help={form.sortOrderHelp}
          values={values}
          inputMode="numeric"
          maxLength={7}
        />
        <div className="flex flex-col gap-3">
          <CheckboxField name="active" label={form.active} values={values} />
          <CheckboxField name="downloadsEnabled" label={form.downloadsEnabled} values={values} />
        </div>
      </FormSection>

      <FormActions
        submitLabel={mode === "new" ? text.add : copy.common.save}
        cancelHref="/admin/ebooks"
        pending={pending}
      />
    </form>
  );
}
