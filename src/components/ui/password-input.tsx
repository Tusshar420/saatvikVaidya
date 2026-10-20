"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  passwordStrength,
  type PasswordStrength,
} from "@/lib/password-strength";
import { ui } from "@/content/ui";
import { Field, inputFrameClasses, useFieldIds } from "./field";

const strengthBars: Record<PasswordStrength, { filled: number; tone: string }> =
  {
    empty: { filled: 0, tone: "bg-line" },
    weak: { filled: 1, tone: "bg-danger" },
    fair: { filled: 2, tone: "bg-gold" },
    strong: { filled: 3, tone: "bg-success" },
  };

export type PasswordInputProps = Omit<
  ComponentProps<"input">,
  "type" | "children"
> & {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  /** Shows the strength hint under the field (use on sign-up). */
  showStrength?: boolean;
  wrapperClassName?: string;
};

export function PasswordInput({
  id,
  label,
  help,
  error,
  showStrength = false,
  wrapperClassName,
  className,
  value,
  defaultValue,
  onChange,
  ...props
}: PasswordInputProps) {
  const ids = useFieldIds(id, { help, error });
  const strengthId = `${ids.inputId}-strength`;
  const [visible, setVisible] = useState(false);
  const [inner, setInner] = useState(String(defaultValue ?? ""));
  const current = value !== undefined ? String(value) : inner;
  const strength = passwordStrength(current);
  const bars = strengthBars[strength];

  const describedBy =
    [ids.describedBy, showStrength ? strengthId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <Field
      ids={ids}
      label={label}
      help={help}
      error={error}
      className={wrapperClassName}
    >
      <div className={cn(inputFrameClasses, className)}>
        <input
          id={ids.inputId}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed"
          value={value}
          defaultValue={value === undefined ? defaultValue : undefined}
          onChange={(event) => {
            if (value === undefined) setInner(event.target.value);
            onChange?.(event);
          }}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? ui.password.hide : ui.password.show}
          aria-controls={ids.inputId}
          disabled={props.disabled}
          className="flex h-full w-11 shrink-0 cursor-pointer items-center justify-center text-muted transition hover:text-brand focus-visible:-outline-offset-2"
        >
          {visible ? (
            <EyeOff aria-hidden className="size-5" />
          ) : (
            <Eye aria-hidden className="size-5" />
          )}
        </button>
      </div>
      {showStrength && (
        <div id={strengthId} className="mt-2" aria-live="polite">
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i < bars.filled ? bars.tone : "bg-line",
                )}
              />
            ))}
          </div>
          <p className="mt-1.5 text-small text-muted">
            <span className="sr-only">{ui.password.strengthLabel}: </span>
            {ui.password.strength[strength]}
          </p>
        </div>
      )}
    </Field>
  );
}
