"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  saveNotificationsAction,
  sendTestEmailAction,
  sendVerificationEmailAction,
  updateNameAction,
} from "@/app/(site)/account/actions";
import { TextField, useFormValues } from "@/components/admin/form-fields";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/ui/password-input";
import { account as copy } from "@/content/account";
import { idleForm } from "@/server/admin/form";

/** Edit the signed-in user's name. */
export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateNameAction, idleForm);
  const values = useFormValues({ name }, state);
  return (
    <form action={action} noValidate aria-labelledby="account-name-title" className="flex flex-col gap-4">
      <h3 id="account-name-title" className="text-base font-extrabold text-ink">
        {copy.nameForm.title}
      </h3>
      {state.status !== "idle" && state.message && (
        <FormAlert tone={state.status === "success" ? "success" : "error"}>{state.message}</FormAlert>
      )}
      <TextField name="name" label={copy.nameForm.label} values={values} autoComplete="name" maxLength={80} required />
      <Button type="submit" variant="secondary" loading={pending} className="self-start max-sm:w-full">
        {copy.nameForm.save}
      </Button>
    </form>
  );
}

/** "Send verification link" for an email that isn't verified yet. */
export function VerifyEmailButton() {
  const [state, action, pending] = useActionState(sendVerificationEmailAction, idleForm);
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      {state.status !== "idle" && state.message && (
        <FormAlert tone={state.status === "success" ? "success" : "error"}>{state.message}</FormAlert>
      )}
      {state.status !== "success" && (
        <Button type="submit" variant="secondary" size="sm" loading={pending} className="self-start max-sm:w-full">
          {copy.emailVerify.send}
        </Button>
      )}
    </form>
  );
}

/** "Send a test email" to the account's own address, showing the result or the mail error. */
export function TestEmailButton() {
  const [state, action, pending] = useActionState(sendTestEmailAction, idleForm);
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <p className="text-xs text-muted">{copy.testEmail.hint}</p>
      {state.status !== "idle" && state.message && (
        <FormAlert tone={state.status === "success" ? "success" : "error"}>{state.message}</FormAlert>
      )}
      <Button type="submit" variant="secondary" size="sm" loading={pending} className="self-start max-sm:w-full">
        {copy.testEmail.send}
      </Button>
    </form>
  );
}

/** Change password: current password, then the new one. */
export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, idleForm);
  const values = useFormValues({}, state);
  // Remount (and so empty) the fields after a successful change.
  return (
    <form
      key={state.status === "success" ? "done" : "form"}
      action={action}
      noValidate
      aria-labelledby="account-password-title"
      className="flex flex-col gap-4"
    >
      <h2 id="account-password-title" className="text-h3 text-ink">
        {copy.password.title}
      </h2>
      {state.status === "success" && <FormAlert tone="success">{state.message}</FormAlert>}
      {state.status === "error" && state.message && <FormAlert>{state.message}</FormAlert>}
      <PasswordInput
        name="currentPassword"
        label={copy.password.current}
        error={values.error("currentPassword")}
        autoComplete="current-password"
        required
      />
      <PasswordInput
        name="newPassword"
        label={copy.password.next}
        error={values.error("newPassword")}
        autoComplete="new-password"
        showStrength
        required
      />
      <Button type="submit" loading={pending} className="self-start max-sm:w-full">
        {copy.password.save}
      </Button>
    </form>
  );
}

export type NotificationValues = {
  notifyOrderSms: boolean;
  notifyOrderEmail: boolean;
  marketingOptIn: boolean;
};

/** Which messages we may send. */
export function NotificationsForm({
  initial,
  hasEmail,
  hasPhone,
}: {
  initial: NotificationValues;
  hasEmail: boolean;
  hasPhone: boolean;
}) {
  const [state, action, pending] = useActionState(saveNotificationsAction, idleForm);
  const text = copy.notifications;
  return (
    <form action={action} aria-labelledby="account-notifications-title" className="flex flex-col gap-1">
      <h2 id="account-notifications-title" className="text-h3 text-ink">
        {text.title}
      </h2>
      <p className="text-sm text-muted">{text.intro}</p>
      {state.status !== "idle" && state.message && (
        <FormAlert tone={state.status === "success" ? "success" : "error"} className="mt-3">
          {state.message}
        </FormAlert>
      )}
      <div className="mt-2 flex flex-col">
        {hasPhone && (
          <Checkbox name="notifyOrderSms" defaultChecked={initial.notifyOrderSms} help={text.orderSmsHelp}>
            {text.orderSms}
          </Checkbox>
        )}
        {hasEmail && (
          <Checkbox name="notifyOrderEmail" defaultChecked={initial.notifyOrderEmail} help={text.orderEmailHelp}>
            {text.orderEmail}
          </Checkbox>
        )}
        <Checkbox name="marketingOptIn" defaultChecked={initial.marketingOptIn} help={text.marketingHelp}>
          {text.marketing}
        </Checkbox>
      </div>
      <Button type="submit" variant="secondary" loading={pending} className="mt-3 self-start max-sm:w-full">
        {text.save}
      </Button>
    </form>
  );
}
