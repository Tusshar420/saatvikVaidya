import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Field, inputClasses, useFieldIds } from "./field";

export type InputProps = Omit<ComponentProps<"input">, "children"> & {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  /** Class for the outer wrapper; `className` styles the input itself. */
  wrapperClassName?: string;
};

export function Input({
  id,
  label,
  help,
  error,
  optional,
  wrapperClassName,
  className,
  ...props
}: InputProps) {
  const ids = useFieldIds(id, { help, error });
  return (
    <Field
      ids={ids}
      label={label}
      help={help}
      error={error}
      optional={optional}
      className={wrapperClassName}
    >
      <input
        id={ids.inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(inputClasses, className)}
        {...props}
      />
    </Field>
  );
}
