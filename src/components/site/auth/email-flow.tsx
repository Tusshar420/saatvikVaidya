"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { authErrors } from "@/content/auth";
import { signIn as copy } from "@/content/sign-in";
import {
  registerWithEmail,
  requestPasswordReset,
  signInWithEmail,
  type AuthFailure,
} from "@/lib/auth-client";
import type { SignUpUserType } from "@/server/content/user-types";
import { FormAlert } from "./form-alert";
import { TwoFactorStep } from "./two-factor-step";
import type { SignedIn } from "./phone-flow";
import {
  emptyRegistration,
  focusFirstError,
  RegistrationFields,
  toRegistration,
  validateRegistration,
  type RegistrationErrors,
  type RegistrationValues,
} from "./registration-fields";

type Mode = "sign-in" | "register" | "forgot";

type FieldErrors = RegistrationErrors & { email?: string; password?: string };

const fieldOrder = ["name", "email", "password", "userType", "terms"] as const;

const passwordCodes = new Set<AuthFailure["code"]>([
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "PASSWORD_TOO_COMMON",
]);

/** A light check before asking the server, which checks properly. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Which field a server error belongs to; undefined means the whole form. */
function fieldFor(code: AuthFailure["code"]): keyof FieldErrors | undefined {
  if (code === "INVALID_EMAIL") return "email";
  if (passwordCodes.has(code)) return "password";
  if (code === "TERMS_NOT_ACCEPTED") return "terms";
  if (code === "INVALID_USER_TYPE") return "userType";
  return undefined;
}

export type EmailFlowProps = {
  userTypes: readonly SignUpUserType[];
  onSignedIn: (result: SignedIn) => void;
};

/** Email tab: sign in, create an account, or ask for a reset link. */
export function EmailFlow({ userTypes, onSignedIn }: EmailFlowProps) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registration, setRegistration] =
    useState<RegistrationValues>(emptyRegistration);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [resetSentTo, setResetSentTo] = useState<string>();
  const [busy, setBusy] = useState(false);
  // After the password step, an admin's sign-in asks for a second code.
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  // Focus the first field when switching between sign in, register and
  // forgot password (not on first render; the tab keeps focus then).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (mode === "register") nameRef.current?.focus();
    else emailRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (resetSentTo) backRef.current?.focus();
  }, [resetSentTo]);

  const switchTo = (next: Mode) => {
    setErrors({});
    setFormError(undefined);
    setResetSentTo(undefined);
    setMode(next);
  };

  const clearError = (...fields: (keyof FieldErrors)[]) =>
    setErrors((current) => {
      const next = { ...current };
      for (const field of fields) delete next[field];
      return next;
    });

  const showErrors = (next: FieldErrors) => {
    setErrors(next);
    focusFirstError(formRef.current, next, fieldOrder);
  };

  const showFailure = (failure: AuthFailure) => {
    const field = fieldFor(failure.code);
    if (field) showErrors({ [field]: failure.message });
    else setFormError(failure.message);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setFormError(undefined);

    const next: FieldErrors =
      mode === "register" ? validateRegistration(registration) : {};
    if (!looksLikeEmail(email)) next.email = authErrors.INVALID_EMAIL;
    if (mode === "sign-in" && !password)
      next.password = copy.email.passwordRequired;
    if (mode === "register" && password.length < 8)
      next.password = authErrors.PASSWORD_TOO_SHORT;
    if (Object.keys(next).length > 0) {
      showErrors(next);
      return;
    }
    setErrors({});

    setBusy(true);
    const trimmed = email.trim();
    if (mode === "forgot") {
      const result = await requestPasswordReset(trimmed);
      setBusy(false);
      if (result.ok) setResetSentTo(trimmed);
      else showFailure(result.error);
      return;
    }
    const result =
      mode === "sign-in"
        ? await signInWithEmail(trimmed, password)
        : await registerWithEmail(
            trimmed,
            password,
            toRegistration(registration),
          );
    setBusy(false);
    if (!result.ok) {
      showFailure(result.error);
    } else if (result.data.twoFactorRedirect) {
      setNeedsTwoFactor(true);
    } else {
      onSignedIn({ name: result.data.user.name, isNew: mode === "register" });
    }
  };

  const heading = {
    "sign-in": copy.email.signInHeading,
    register: copy.email.registerHeading,
    forgot: copy.email.forgotHeading,
  }[mode];

  if (needsTwoFactor) {
    return (
      <TwoFactorStep
        onVerified={(name) => onSignedIn({ name, isNew: false })}
        onBack={() => {
          setNeedsTwoFactor(false);
          setPassword("");
        }}
      />
    );
  }

  if (mode === "forgot" && resetSentTo) {
    return (
      <div className="flex flex-col">
        <h3 className="text-lg font-extrabold text-ink">{heading}</h3>
        <FormAlert tone="success" className="mt-3">
          {copy.email.forgotSent(resetSentTo)}
        </FormAlert>
        <Button
          ref={backRef}
          type="button"
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => switchTo("sign-in")}
        >
          {copy.email.backToSignIn}
        </Button>
      </div>
    );
  }

  const emailField = (
    <div data-field="email">
      <Input
        ref={emailRef}
        type="email"
        label={copy.email.email}
        placeholder={copy.email.emailPlaceholder}
        autoComplete="email"
        inputMode="email"
        maxLength={191}
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          clearError("email");
        }}
        error={errors.email}
      />
    </div>
  );

  const passwordField = mode !== "forgot" && (
    <div data-field="password">
      <PasswordInput
        label={
          mode === "register" ? copy.email.newPassword : copy.email.password
        }
        autoComplete={mode === "register" ? "new-password" : "current-password"}
        maxLength={128}
        showStrength={mode === "register"}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          clearError("password");
        }}
        error={errors.password}
      />
    </div>
  );

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col">
      <h3 className="text-lg font-extrabold text-ink">{heading}</h3>
      {mode === "forgot" && (
        <p className="mt-1 text-sm text-muted">{copy.email.forgotLead}</p>
      )}
      <div className="mt-4 flex flex-col gap-4">
        {mode === "register" ? (
          userTypes.length === 0 ? (
            <FormAlert>{copy.register.unavailable}</FormAlert>
          ) : (
            <RegistrationFields
              values={registration}
              onChange={(patch) => {
                setRegistration((current) => ({ ...current, ...patch }));
                if ("name" in patch) clearError("name");
                if ("userTypeId" in patch) clearError("userType");
                if ("terms" in patch) clearError("terms");
              }}
              errors={errors}
              userTypes={userTypes}
              nameRef={nameRef}
            >
              {emailField}
              {passwordField}
            </RegistrationFields>
          )
        ) : (
          <>
            {emailField}
            {passwordField}
          </>
        )}
      </div>
      {mode === "sign-in" && (
        <Button
          type="button"
          variant="link"
          className="mt-1 self-end text-small font-bold"
          onClick={() => switchTo("forgot")}
        >
          {copy.email.forgot}
        </Button>
      )}
      {formError && <FormAlert className="mt-3">{formError}</FormAlert>}
      <Button
        type="submit"
        arrow
        loading={busy}
        disabled={mode === "register" && userTypes.length === 0}
        className="mt-4 w-full"
      >
        {mode === "sign-in"
          ? copy.email.submit
          : mode === "register"
            ? copy.email.registerSubmit
            : copy.email.forgotSubmit}
      </Button>
      <p className="mt-3 text-center text-sm text-muted">
        {mode === "sign-in" ? (
          <>
            {copy.email.toRegister}{" "}
            <Button
              type="button"
              variant="link"
              className="inline-flex font-extrabold"
              onClick={() => switchTo("register")}
            >
              {copy.email.toRegisterLink}
            </Button>
          </>
        ) : mode === "register" ? (
          <>
            {copy.email.toSignIn}{" "}
            <Button
              type="button"
              variant="link"
              className="inline-flex font-extrabold"
              onClick={() => switchTo("sign-in")}
            >
              {copy.email.toSignInLink}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="link"
            className="inline-flex font-extrabold"
            onClick={() => switchTo("sign-in")}
          >
            {copy.email.backToSignIn}
          </Button>
        )}
      </p>
    </form>
  );
}
