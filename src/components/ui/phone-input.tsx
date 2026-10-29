"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { normalizeIndianPhone } from "@/lib/phone";
import { ui } from "@/content/ui";
import { Field, inputFrameClasses, useFieldIds } from "./field";

export type PhoneInputProps = Omit<
  ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "type" | "children"
> & {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  /** The 10 national digits (controlled). */
  value?: string;
  defaultValue?: string;
  /** Called with the cleaned value: digits only, at most 10. */
  onValueChange?: (digits: string) => void;
  wrapperClassName?: string;
};

/**
 * Indian mobile number input: a fixed +91 prefix and up to 10 digits. Anything
 * else typed or pasted is stripped (see normalizeIndianPhone).
 */
export function PhoneInput({
  id,
  label,
  help,
  error,
  value,
  defaultValue = "",
  onValueChange,
  wrapperClassName,
  className,
  ...props
}: PhoneInputProps) {
  const ids = useFieldIds(id, { help, error });
  const [inner, setInner] = useState(() => normalizeIndianPhone(defaultValue));
  const current = value !== undefined ? normalizeIndianPhone(value) : inner;

  return (
    <Field
      ids={ids}
      label={
        <>
          {label} <span className="sr-only">({ui.phone.countryCode})</span>
        </>
      }
      help={help}
      error={error}
      className={wrapperClassName}
    >
      <div className={cn(inputFrameClasses, className)}>
        <span
          className="flex h-full shrink-0 items-center border-r border-line px-3 text-small font-semibold text-ink"
          aria-hidden
        >
          {ui.phone.countryCode}
        </span>
        <input
          id={ids.inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          pattern="[0-9]{10}"
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed"
          value={current}
          onChange={(event) => {
            const digits = normalizeIndianPhone(event.target.value);
            if (value === undefined) setInner(digits);
            onValueChange?.(digits);
          }}
          {...props}
        />
      </div>
    </Field>
  );
}
