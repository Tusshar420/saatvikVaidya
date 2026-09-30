"use client";

import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, inputClasses, useFieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { admin as copy } from "@/content/admin";
import { cn } from "@/lib/cn";
import type { FormState } from "@/server/admin/form";

// Field wrappers for the admin forms. They are uncontrolled: each takes its
// starting value, and after a failed save the form shows what was submitted
// (from FormState.values) along with each field's error.

export type FieldValues = Record<string, string | number | boolean | null>;

/**
 * Reads a field's value: what was just submitted if the save failed,
 * otherwise the saved value.
 */
export function useFormValues(initial: FieldValues, state: FormState) {
  const submitted = state.status === "error" ? state.values : undefined;
  return {
    text(name: string): string {
      if (submitted) return submitted[name] ?? "";
      const value = initial[name];
      return value === null || value === undefined ? "" : String(value);
    },
    checked(name: string): boolean {
      if (submitted) return submitted[name] === "on";
      return initial[name] === true;
    },
    error(name: string): string | undefined {
      return state.fieldErrors?.[name];
    },
  };
}

type Values = ReturnType<typeof useFormValues>;

type BaseProps = {
  name: string;
  label: ReactNode;
  help?: ReactNode;
  values: Values;
  optional?: boolean;
  className?: string;
};

export function TextField({
  name,
  label,
  help,
  values,
  optional,
  className,
  ...props
}: BaseProps &
  Omit<ComponentProps<"input">, "name" | "defaultValue" | "children">) {
  return (
    <Input
      name={name}
      label={label}
      help={help}
      error={values.error(name)}
      optional={optional}
      defaultValue={values.text(name)}
      wrapperClassName={className}
      {...props}
    />
  );
}

export function TextAreaField({
  name,
  label,
  help,
  values,
  optional,
  className,
  rows = 3,
  ...props
}: BaseProps &
  Omit<ComponentProps<"textarea">, "name" | "defaultValue" | "children">) {
  const error = values.error(name);
  const ids = useFieldIds(undefined, { help, error });
  return (
    <Field
      ids={ids}
      label={label}
      help={help}
      error={error}
      optional={optional}
      className={className}
    >
      <textarea
        id={ids.inputId}
        name={name}
        rows={rows}
        defaultValue={values.text(name)}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(inputClasses, "h-auto py-3 leading-normal")}
        {...props}
      />
    </Field>
  );
}

export type SelectOption = { value: string; label: string };

export function SelectField({
  name,
  label,
  help,
  values,
  optional,
  className,
  options,
  ...props
}: BaseProps &
  Omit<ComponentProps<"select">, "name" | "defaultValue" | "children"> & {
    options: readonly SelectOption[];
  }) {
  const error = values.error(name);
  const ids = useFieldIds(undefined, { help, error });
  return (
    <Field
      ids={ids}
      label={label}
      help={help}
      error={error}
      optional={optional}
      className={className}
    >
      <select
        id={ids.inputId}
        name={name}
        defaultValue={values.text(name)}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(inputClasses, "cursor-pointer")}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxField({
  name,
  label,
  help,
  values,
  className,
}: Omit<BaseProps, "optional">) {
  return (
    <Checkbox
      name={name}
      defaultChecked={values.checked(name)}
      help={help}
      error={values.error(name)}
      className={className}
    >
      {label}
    </Checkbox>
  );
}

/** A titled group of fields in a card. */
export function FormSection({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      className={cn(
        "rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6",
        className,
      )}
    >
      <legend className="float-left mb-4 w-full text-h3 text-ink">
        {title}
      </legend>
      <div className="clear-both grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** The form-level error after a failed save. */
export function FormError({ state }: { state: FormState }) {
  if (state.status !== "error") return null;
  return (
    <FormAlert tone="error">{state.message ?? copy.common.formError}</FormAlert>
  );
}

/** Submit and cancel. */
export function FormActions({
  submitLabel,
  cancelHref,
  pending,
}: {
  submitLabel: string;
  cancelHref: string;
  pending: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 max-sm:*:w-full">
      <Button type="submit" loading={pending}>
        {submitLabel}
      </Button>
      <Link
        href={cancelHref}
        className={buttonClasses({ variant: "secondary" })}
      >
        {copy.common.cancel}
      </Link>
    </div>
  );
}
