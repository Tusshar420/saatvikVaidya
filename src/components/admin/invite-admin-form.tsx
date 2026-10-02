"use client";

import { useActionState } from "react";
import { inviteAdminAction } from "@/app/admin/admins/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { adminSecurity as copy } from "@/content/admin-security";
import { adminRoles } from "@/lib/admin-permissions";
import { idleForm } from "@/server/admin/form";
import { SelectField, TextField, useFormValues } from "./form-fields";

const text = copy.admins;

/** Super admins: email and role for a new admin. */
export function InviteAdminForm() {
  const [state, action, pending] = useActionState(inviteAdminAction, idleForm);
  const values = useFormValues({ email: "", role: "orders" }, state);
  return (
    <form
      // Fresh (empty) fields after a successful invite.
      key={state.status === "success" ? "sent" : "form"}
      action={action}
      noValidate
      className="mt-3 flex flex-col gap-4"
    >
      {state.status === "success" && <FormAlert tone="success">{state.message}</FormAlert>}
      {state.status === "error" && state.message && !state.fieldErrors && (
        <FormAlert>{state.message}</FormAlert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="email"
          type="email"
          label={text.inviteEmail}
          values={values}
          autoComplete="off"
          maxLength={191}
          required
        />
        <SelectField
          name="role"
          label={text.inviteRole}
          values={values}
          options={adminRoles.map((role) => ({
            value: role,
            label: `${copy.roles[role]}: ${copy.roleHelp[role]}`,
          }))}
        />
      </div>
      <Button type="submit" loading={pending} className="self-start max-sm:w-full">
        {text.inviteSubmit}
      </Button>
    </form>
  );
}
