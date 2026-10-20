"use client";

import type { ReactNode, Ref } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Input } from "@/components/ui/input";
import { signIn as copy } from "@/content/sign-in";
import type { Registration } from "@/lib/auth-client";
import type { SignUpUserType } from "@/server/content/user-types";

export type RegistrationValues = {
  name: string;
  /** The chosen UserType id as a string ("" until chosen). */
  userTypeId: string;
  terms: boolean;
  marketing: boolean;
};

export const emptyRegistration: RegistrationValues = {
  name: "",
  userTypeId: "",
  terms: false,
  marketing: false,
};

export type RegistrationField = "name" | "userType" | "terms";
export type RegistrationErrors = Partial<Record<RegistrationField, string>>;

/** Same rules as the server (src/server/auth/schemas.ts), checked early. */
export function validateRegistration(
  values: RegistrationValues,
): RegistrationErrors {
  const errors: RegistrationErrors = {};
  const name = values.name.trim();
  if (name.length < 2 || name.length > 80)
    errors.name = copy.register.nameError;
  if (!values.userTypeId) errors.userType = copy.register.userTypeError;
  if (!values.terms) errors.terms = copy.register.termsError;
  return errors;
}

export function toRegistration(values: RegistrationValues): Registration {
  return {
    name: values.name.trim(),
    userTypeId: Number(values.userTypeId),
    termsAccepted: values.terms,
    marketingOptIn: values.marketing,
  };
}

/** Where to move focus for the first field with an error. */
export function focusFirstError(
  form: HTMLFormElement | null,
  errors: Partial<Record<string, string>>,
  order: readonly string[],
) {
  const first = order.find((field) => errors[field]);
  if (!first || !form) return;
  const target = form.querySelector<HTMLElement>(
    `[data-field="${first}"] input:not([type=hidden]), [data-field="${first}"] [role=radio]`,
  );
  target?.focus();
}

export type RegistrationFieldsProps = {
  values: RegistrationValues;
  onChange: (patch: Partial<RegistrationValues>) => void;
  errors: RegistrationErrors;
  userTypes: readonly SignUpUserType[];
  disabled?: boolean;
  /** Gets the name input, so a step can focus it when it opens. */
  nameRef?: Ref<HTMLInputElement>;
  /** Rendered between the name and the "I am a" choice (email + password). */
  children?: ReactNode;
};

/**
 * The details a new account needs, shared by phone and email sign-up: name,
 * "I am a", terms (required) and marketing (optional).
 */
export function RegistrationFields({
  values,
  onChange,
  errors,
  userTypes,
  disabled,
  nameRef,
  children,
}: RegistrationFieldsProps) {
  const chosen = userTypes.find(
    (type) => String(type.id) === values.userTypeId,
  );
  return (
    <div className="flex flex-col gap-4">
      <div data-field="name">
        <Input
          ref={nameRef}
          label={copy.register.name}
          placeholder={copy.register.namePlaceholder}
          autoComplete="name"
          maxLength={80}
          value={values.name}
          onChange={(event) => onChange({ name: event.target.value })}
          error={errors.name}
          disabled={disabled}
        />
      </div>
      {children}
      <div data-field="userType">
        <ChoiceChips
          label={copy.register.userType}
          options={userTypes.map((type) => ({
            value: String(type.id),
            label: type.label,
          }))}
          value={values.userTypeId}
          onValueChange={(userTypeId) => onChange({ userTypeId })}
          error={errors.userType}
          disabled={disabled}
          required
        />
        {chosen?.requiresVerification && (
          <p className="mt-2 text-small text-muted">
            {copy.register.professionalNote}
          </p>
        )}
      </div>
      <div className="-my-1">
        <div data-field="terms">
          <Checkbox
            checked={values.terms}
            onChange={(event) => onChange({ terms: event.target.checked })}
            error={errors.terms}
            disabled={disabled}
            required
          >
            {copy.register.termsLead}{" "}
            <LegalLink href="/terms">{copy.register.termsLink}</LegalLink>{" "}
            {copy.register.termsJoin}{" "}
            <LegalLink href="/privacy">{copy.register.privacyLink}</LegalLink>.
          </Checkbox>
        </div>
        <Checkbox
          checked={values.marketing}
          onChange={(event) => onChange({ marketing: event.target.checked })}
          disabled={disabled}
        >
          {copy.register.marketing}
        </Checkbox>
      </div>
    </div>
  );
}

/** Opens in a new tab so the half-filled form isn't lost. */
function LegalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="font-bold text-brand underline underline-offset-2"
    >
      {children}
      <span className="sr-only"> {copy.register.newTab}</span>
    </a>
  );
}
