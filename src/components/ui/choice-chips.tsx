"use client";

import { useId, type ReactNode } from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { cn } from "@/lib/cn";

export type ChoiceOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type ChoiceChipsProps = {
  /** Group label, shown above the chips unless `hideLabel`. */
  label: ReactNode;
  hideLabel?: boolean;
  options: readonly ChoiceOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  error?: ReactNode;
  /** `wrap` for forms (user type); `scroll` for a one-line filter row. */
  layout?: "wrap" | "scroll";
  className?: string;
};

/**
 * Single-select chips (a radio group): arrow keys move between chips, Tab
 * leaves the group.
 */
export function ChoiceChips({
  label,
  hideLabel = false,
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  required,
  disabled,
  error,
  layout = "wrap",
  className,
}: ChoiceChipsProps) {
  const labelId = useId();
  const errorId = useId();

  return (
    <div className={cn("flex flex-col", className)}>
      <span
        id={labelId}
        className={cn(
          "mb-2 text-xs font-extrabold text-ink",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </span>
      <RadioGroup.Root
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        name={name}
        required={required}
        disabled={disabled}
        orientation="horizontal"
        loop
        className={cn(
          "flex gap-2",
          layout === "wrap"
            ? "flex-wrap"
            : "-mx-1 scrollbar-none overflow-x-auto px-1 py-1",
        )}
      >
        {options.map((option) => (
          <RadioGroup.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn(
              "inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-sm border border-line bg-surface px-3.5 text-sm font-semibold whitespace-nowrap text-ink transition",
              "hover:border-brand/60 disabled:cursor-not-allowed disabled:opacity-50",
              "data-[state=checked]:border-brand data-[state=checked]:bg-brand-soft data-[state=checked]:font-extrabold data-[state=checked]:text-brand",
            )}
          >
            {option.label}
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      {error && (
        <p id={errorId} className="mt-1.5 text-small font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
