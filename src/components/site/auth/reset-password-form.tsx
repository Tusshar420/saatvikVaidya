"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { authErrors } from "@/content/auth";
import { signIn as copy } from "@/content/sign-in";
import { resetPassword } from "@/lib/auth-client";
import { SiteModalButton } from "../site-modals";
import { FormAlert } from "./form-alert";

/**
 * Sets a new password with the token from the emailed link. Afterwards (or
 * when the link is no good) it offers sign-in, where a new link can be
 * requested.
 */
export function ResetPasswordForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [state, setState] = useState<"form" | "done" | "invalid">(
    token ? "form" : "invalid",
  );
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state !== "form") resultRef.current?.focus();
  }, [state]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !token) return;
    if (password.length < 8) {
      setError(authErrors.PASSWORD_TOO_SHORT);
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    const result = await resetPassword(token, password);
    setBusy(false);
    if (result.ok) {
      setState("done");
    } else if (result.error.code === "INVALID_TOKEN") {
      setState("invalid");
    } else {
      setError(result.error.message);
      inputRef.current?.focus();
    }
  };

  if (state !== "form") {
    const done = state === "done";
    return (
      <div ref={resultRef} tabIndex={-1} className="focus:outline-none">
        <FormAlert tone={done ? "success" : "error"}>
          <strong className="block">
            {done ? copy.resetPage.done : copy.resetPage.invalid}
          </strong>
          {done ? copy.resetPage.doneLead : copy.resetPage.invalidLead}
        </FormAlert>
        <SiteModalButton
          modal="signIn"
          className={buttonClasses({ className: "mt-5 w-full sm:w-auto" })}
        >
          {done ? copy.resetPage.signIn : copy.resetPage.requestNew}
        </SiteModalButton>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col">
      <PasswordInput
        ref={inputRef}
        label={copy.email.newPassword}
        autoComplete="new-password"
        maxLength={128}
        showStrength
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setError(undefined);
        }}
        error={error}
      />
      <Button type="submit" arrow loading={busy} className="mt-5 sm:self-start">
        {copy.resetPage.submit}
      </Button>
    </form>
  );
}
