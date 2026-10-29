"use client";

import { useActionState } from "react";
import { adminHome as copy, type HomeField, type HomeKindKey, homeKinds } from "@/content/admin-site";
import { admin as adminCopy } from "@/content/admin";
import { idleForm, type FormState } from "@/server/admin/form";
import { KeyField } from "./content-fields";
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

type Values = ReturnType<typeof useFormValues>;

function Field({ field, values }: { field: HomeField; values: Values }) {
  const common = {
    name: field.name,
    label: field.label,
    help: field.help,
    values,
    className: field.wide ? "sm:col-span-2" : undefined,
  };
  switch (field.type) {
    case "checkbox":
      return <CheckboxField {...common} />;
    case "select":
      return <SelectField {...common} options={field.options ?? []} />;
    case "textarea":
      return <TextAreaField {...common} maxLength={field.max} optional={field.optional} />;
    case "json":
      return (
        <TextAreaField
          {...common}
          help={field.help ?? copy.jsonHelp}
          rows={10}
          spellCheck={false}
          className="font-mono sm:col-span-2"
          optional={field.optional}
        />
      );
    case "number":
      return <TextField {...common} type="number" inputMode="numeric" />;
    default:
      return <TextField {...common} maxLength={field.max} optional={field.optional} />;
  }
}

/** Create or edit one homepage item; the fields come from the kind's spec. */
export function HomeContentForm({
  kind,
  action,
  initial,
  mode,
}: {
  kind: HomeKindKey;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: FieldValues;
  mode: "new" | "edit";
}) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const values = useFormValues(initial, state);
  const spec = homeKinds[kind];
  return (
    <form action={formAction} noValidate className="mt-6 flex max-w-4xl flex-col gap-5">
      <FormError state={state} />
      <FormSection title={mode === "new" ? copy.newTitle(spec.label) : copy.editTitle(spec.label)}>
        <KeyField mode={mode} values={values} />
        {spec.fields.map((field) => (
          <Field key={field.name} field={field} values={values} />
        ))}
      </FormSection>
      <FormActions
        submitLabel={mode === "new" ? adminCopy.common.create : adminCopy.common.save}
        cancelHref={`/admin/content/${spec.path}`}
        pending={pending}
      />
    </form>
  );
}
