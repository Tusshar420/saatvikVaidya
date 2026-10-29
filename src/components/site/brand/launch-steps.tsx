import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/content/ui";

export type LaunchStepsProps = {
  label: string;
  steps: readonly { label: string; detail?: string }[];
  /** Index of the active step; earlier steps are done. */
  current: number;
  className?: string;
};

/**
 * The v2 steps bar (`.stepper`): one white strip of numbered steps, the
 * active one tinted green; stacked on phones.
 */
export function LaunchSteps({
  label,
  steps,
  current,
  className,
}: LaunchStepsProps) {
  return (
    <ol
      aria-label={label}
      className={cn(
        "grid overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-4",
        className,
      )}
    >
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step.label}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-2.5 border-line px-3.25 py-2.75 last:border-0 max-sm:border-b sm:border-r sm:px-4.25 sm:py-3.75",
              active
                ? "bg-orange-soft text-orange-ink"
                : done
                  ? "text-brand-mid"
                  : "text-muted",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-6.5 shrink-0 place-items-center rounded-sm font-heading text-[11px] font-extrabold",
                active || done
                  ? "bg-brand text-white"
                  : "bg-surface-alt text-muted ring-1 ring-line",
              )}
            >
              {done ? (
                <Check strokeWidth={3} className="size-3.5" />
              ) : (
                index + 1
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] leading-tight font-bold">
                {step.label}
                {done && <span className="sr-only"> ({ui.stepper.done})</span>}
                {active && (
                  <span className="sr-only"> ({ui.stepper.current})</span>
                )}
              </span>
              {step.detail && (
                <span className="mt-0.5 truncate text-[11px] leading-tight">
                  {step.detail}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
