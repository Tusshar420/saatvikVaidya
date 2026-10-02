"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acceptInviteAction } from "@/app/(site)/admin-invite/[token]/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { signInPath } from "@/lib/auth-routes";
import { adminSecurity } from "@/content/admin-security";
import { passwordPolicy } from "@/server/auth/policy";
import { idleForm } from "@/server/admin/form";
import { TextField, useFormValues } from "./form-fields";

const text = adminSecurity.invite.page;

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    acceptInviteAction.bind(null, token),
    idleForm,
  );
  const values = useFormValues({ name: "" }, state);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert tone="success">{text.done}</FormAlert>
        <Link href={signInPath("/admin")} className={buttonClasses({ className: "self-start max-sm:w-full" })}>
          {text.signIn}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {state.status === "error" && state.message && <FormAlert>{state.message}</FormAlert>}
      <TextField
        name="name"
        label={text.name}
        values={values}
        autoComplete="name"
        maxLength={80}
        required
      />
      <PasswordInput
        name="password"
        label={text.password}
        help={text.passwordHelp(passwordPolicy.adminMinLength)}
        error={values.error("password")}
        autoComplete="new-password"
        showStrength
        maxLength={128}
        required
      />
      <PasswordInput
        name="confirm"
        label={text.confirm}
        error={values.error("confirm")}
        autoComplete="new-password"
        maxLength={128}
        required
      />
      <Button type="submit" loading={pending} className="self-start max-sm:w-full">
        {text.submit}
      </Button>
    </form>
  );
}
