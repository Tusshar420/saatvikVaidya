"use client";

import { useActionState, useState } from "react";
import { inviteAdminAction, type InviteFormState } from "@/app/admin/admins/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { adminSecurity as copy } from "@/content/admin-security";
import { adminRoles } from "@/lib/admin-permissions";
import { idleForm } from "@/server/admin/form";
import { SelectField, TextField, useFormValues } from "./form-fields";

const text = copy.admins;

/** Super admins: email and role for a new admin. */
export function InviteAdminForm() {
  const [state, action, pending] = useActionState<InviteFormState, FormData>(inviteAdminAction, idleForm);
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
      {state.status === "success" && state.inviteUrl && <InviteLink url={state.inviteUrl} />}
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

/** The one-time link, to send by hand while emails aren't sent. */
function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="invite-link" className="text-sm font-bold text-ink">
        {text.notices.inviteLinkLabel}
      </label>
      <p id="invite-link-help" className="text-small text-muted">
        {text.notices.inviteLinkHelp}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="invite-link"
          readOnly
          value={url}
          aria-describedby="invite-link-help"
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-surface-alt px-3 font-mono text-sm text-ink"
        />
        <Button
          type="button"
          variant="secondary"
          className="max-sm:w-full"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? text.notices.copied : text.notices.copyLink}
        </Button>
      </div>
    </div>
  );
}
