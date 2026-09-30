import type { ComponentProps, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { useFieldIds } from "./field";

export type CheckboxProps = Omit<
  ComponentProps<"input">,
  "type" | "children"
> & {
  /** The consent line; may contain links. */
  children: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
};

/** A native checkbox with a custom box, for terms and consent lines. */
export function Checkbox({
  id,
  children,
  help,
  error,
  className,
  ...props
}: CheckboxProps) {
  const ids = useFieldIds(id, { help, error });
  return (
    <div className={cn("flex flex-col", className)}>
      <label
        htmlFor={ids.inputId}
        className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5 has-disabled:cursor-not-allowed has-disabled:opacity-60"
      >
        <span className="relative mt-px grid size-5 shrink-0 place-items-center">
          <input
            id={ids.inputId}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            aria-describedby={ids.describedBy}
            className="peer size-5 cursor-pointer appearance-none rounded-[6px] border-2 border-muted bg-surface transition checked:border-teal checked:bg-teal disabled:cursor-not-allowed aria-invalid:border-danger"
            {...props}
          />
          <Check
            aria-hidden
            strokeWidth={3}
            className="pointer-events-none absolute size-3.5 text-white opacity-0 peer-checked:opacity-100"
          />
        </span>
        <span className="text-sm leading-snug text-ink">{children}</span>
      </label>
      {error && (
        <p id={ids.errorId} className="ml-8 text-small font-medium text-danger">
          {error}
        </p>
      )}
      {help && (
        <p id={ids.helpId} className="ml-8 text-small text-muted">
          {help}
        </p>
      )}
    </div>
  );
}
