"use client";

import { useActionState } from "react";
import { admin as copy } from "@/content/admin";
import { idleForm, type FormState } from "@/server/admin/form";
import {
  CheckboxField,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  TextField,
  useFormValues,
  type FieldValues,
} from "./form-fields";

const text = copy.userForm;

export type UserFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: FieldValues;
  userTypes: { id: number; label: string }[];
  /** New users get a password field; edits don't. */
  mode: "new" | "edit";
  cancelHref: string;
  adminPasswordMin: number;
};

export function UserForm({
  action,
  initial,
  userTypes,
  mode,
  cancelHref,
  adminPasswordMin,
}: UserFormProps) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const values = useFormValues(initial, state);

  return (
    <form action={formAction} noValidate className="mt-6 flex flex-col gap-5">
      <FormError state={state} />
      <FormSection title={copy.userDetail.detailsTitle}>
        <TextField
          name="name"
          label={text.name}
          values={values}
          autoComplete="off"
          maxLength={80}
          required
          className="sm:col-span-2"
        />
        <TextField
          name="email"
          type="email"
          label={text.email}
          help={text.emailHelp}
          values={values}
          autoComplete="off"
          maxLength={191}
          optional
        />
        <TextField
          name="phone"
          type="tel"
          inputMode="numeric"
          label={text.phone}
          help={text.phoneHelp}
          values={values}
          autoComplete="off"
          maxLength={16}
          optional
        />
        <SelectField
          name="userTypeId"
          label={text.userType}
          values={values}
          options={userTypes.map((type) => ({
            value: String(type.id),
            label: type.label,
          }))}
        />
        <SelectField
          name="verificationStatus"
          label={text.status}
          help={text.statusHelp}
          values={values}
          options={(["none", "pending", "approved", "rejected"] as const).map(
            (status) => ({ value: status, label: copy.users.status[status] }),
          )}
        />
        <SelectField
          name="role"
          label={text.role}
          help={text.roleHelp}
          values={values}
          options={(["user", "admin"] as const).map((role) => ({
            value: role,
            label: copy.users.roles[role],
          }))}
        />
        {mode === "new" && (
          <TextField
            name="password"
            type="password"
            label={text.password}
            help={text.passwordHelp(adminPasswordMin)}
            values={values}
            autoComplete="new-password"
            maxLength={128}
            optional
          />
        )}
        <CheckboxField
          name="marketingOptIn"
          label={text.marketing}
          values={values}
          className="sm:col-span-2"
        />
      </FormSection>
      <FormActions
        submitLabel={mode === "new" ? text.submitNew : text.submitEdit}
        cancelHref={cancelHref}
        pending={pending}
      />
    </form>
  );
}
