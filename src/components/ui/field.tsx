import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ui } from "@/content/ui";

/** Shared look of text inputs (Input, PasswordInput, OtpInput boxes). */
export const inputClasses =
  "h-12 w-full min-w-0 rounded-md border border-line bg-surface-alt px-3.5 text-base text-ink transition placeholder:text-muted focus:border-teal focus:bg-surface aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-60";

/** The same frame for composite inputs (PhoneInput, PasswordInput). */
export const inputFrameClasses =
  "flex h-12 w-full items-center overflow-hidden rounded-md border border-line bg-surface-alt text-base transition focus-within:border-teal focus-within:bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal has-[[aria-invalid=true]]:border-danger has-disabled:opacity-60";

export type FieldIds = {
  inputId: string;
  helpId: string;
  errorId: string;
  /** Value for aria-describedby: help and error ids that are rendered. */
  describedBy: string | undefined;
};

export function useFieldIds(
  id: string | undefined,
  { help, error }: { help?: ReactNode; error?: ReactNode },
): FieldIds {
  const generated = useId();
  const inputId = id ?? generated;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const describedBy =
    [error ? errorId : null, help ? helpId : null].filter(Boolean).join(" ") ||
    undefined;
  return { inputId, helpId, errorId, describedBy };
}

export type FieldProps = {
  ids: FieldIds;
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  /** Use "legend"-style labelling for groups (OtpInput) instead of <label>. */
  labelId?: string;
  className?: string;
  children: ReactNode;
};

/** Label above, help and error text below, wired up for screen readers. */
export function Field({
  ids,
  label,
  help,
  error,
  optional,
  labelId,
  className,
  children,
}: FieldProps) {
  const labelContent = (
    <>
      {label}
      {optional && (
        <span className="ml-1.5 font-medium text-muted">({ui.optional})</span>
      )}
    </>
  );
  const labelClass = "mb-1.5 block text-xs font-extrabold text-ink";

  return (
    <div className={cn("flex flex-col", className)}>
      {labelId ? (
        <span id={labelId} className={labelClass}>
          {labelContent}
        </span>
      ) : (
        <label htmlFor={ids.inputId} className={labelClass}>
          {labelContent}
        </label>
      )}
      {children}
      {error && (
        <p
          id={ids.errorId}
          className="mt-1.5 text-small font-medium text-danger"
        >
          {error}
        </p>
      )}
      {help && (
        <p id={ids.helpId} className="mt-1.5 text-small text-muted">
          {help}
        </p>
      )}
    </div>
  );
}
