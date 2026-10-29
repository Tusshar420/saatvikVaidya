import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/content/ui";

export type StepperStep = {
  label: string;
  /** Short second line, e.g. a date. */
  detail?: string;
};

export type StepperProps = {
  steps: readonly StepperStep[];
  /** Index of the active step. Earlier steps are done; `steps.length` means all done. */
  current: number;
  /** Accessible name for the list, e.g. "Order status". */
  label: string;
  className?: string;
};

/** Horizontal status steps: done in green, the active one orange with a halo. */
export function Stepper({ steps, current, label, className }: StepperProps) {
  return (
    <ol aria-label={label} className={cn("flex items-start", className)}>
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step.label}
            aria-current={active ? "step" : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center"
          >
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-3.25 right-1/2 h-0.5 w-full",
                  index <= current ? "bg-success" : "bg-track",
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-10 grid size-7 place-items-center rounded-full text-[11px] font-bold",
                done && "bg-success text-white",
                active && "bg-orange-strong text-white ring-5 ring-orange/15",
                !done && !active && "border border-line bg-surface text-muted",
              )}
            >
              {done ? (
                <Check strokeWidth={3} className="size-3.5" />
              ) : (
                index + 1
              )}
            </span>
            <span className="px-0.5 text-xs leading-tight font-semibold text-ink">
              {step.label}
              {done && <span className="sr-only"> ({ui.stepper.done})</span>}
              {active && (
                <span className="sr-only"> ({ui.stepper.current})</span>
              )}
            </span>
            {step.detail && (
              <span className="text-[11px] leading-tight text-muted">
                {step.detail}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
