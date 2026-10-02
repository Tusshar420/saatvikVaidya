"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { inputClasses } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export type QuantityStepperProps = {
  id: string;
  /** Accessible name of the number field. */
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  /** How much − and + change the value (default 1). */
  step?: number;
  /** Turns a typed number into an allowed one (default: kept within min…max). */
  normalize?: (value: number) => number;
  /** Called with an allowed whole number when it differs from `value`. */
  onCommit: (value: number) => void;
  /** Called when a typed number had to be changed into an allowed one. */
  onAdjusted?: (typed: number, value: number) => void;
  /** Ids of text that explains the limits (MOQ, stock). */
  describedBy?: string;
  className?: string;
};

/**
 * − [n] + for a quantity. The buttons commit at once; typed numbers commit on
 * Enter or when the field loses focus, kept within min…max (or moved to an
 * allowed value by `normalize`, e.g. a multiple of a minimum).
 */
export function QuantityStepper({
  id,
  label,
  decreaseLabel,
  increaseLabel,
  value,
  min,
  max,
  disabled,
  step = 1,
  normalize,
  onCommit,
  onAdjusted,
  describedBy,
  className,
}: QuantityStepperProps) {
  const [draft, setDraft] = useState(String(value));
  const [shown, setShown] = useState(value);
  // A new value from the server (after a save) replaces what was typed.
  if (shown !== value) {
    setShown(value);
    setDraft(String(value));
  }

  const clamp = (n: number) => Math.min(Math.max(n, min), Math.max(min, max));
  const commitDraft = () => {
    const typed = Number(draft);
    if (!Number.isInteger(typed) || draft.trim() === "") {
      setDraft(String(value));
      return;
    }
    const next = normalize ? normalize(typed) : clamp(typed);
    setDraft(String(next));
    if (next !== typed) onAdjusted?.(typed, next);
    if (next !== value) onCommit(next);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <IconButton
        label={decreaseLabel}
        variant="outline"
        disabled={disabled || value <= min}
        onClick={() => onCommit(clamp(value - step))}
      >
        <Minus aria-hidden />
      </IconButton>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        aria-label={label}
        aria-describedby={describedBy}
        min={min}
        max={max}
        step={step}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitDraft();
          }
        }}
        className={cn(inputClasses, "h-11 w-16 px-1 text-center font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none")}
      />
      <IconButton
        label={increaseLabel}
        variant="outline"
        disabled={disabled || value >= max}
        onClick={() => onCommit(clamp(value + step))}
      >
        <Plus aria-hidden />
      </IconButton>
    </div>
  );
}
