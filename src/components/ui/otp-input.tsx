"use client";

import {
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { ui } from "@/content/ui";
import { Field, inputClasses, useFieldIds } from "./field";

function toSlots(value: string, length: number): string[] {
  const digits = value.replace(/\D/g, "").slice(0, length);
  return Array.from({ length }, (_, i) => digits[i] ?? "");
}

export type OtpInputProps = {
  id?: string;
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  /** Number of boxes. */
  length?: number;
  /** The code (controlled). Changing it from outside resets the boxes. */
  value?: string;
  defaultValue?: string;
  /** Called with the digits entered so far, in order. */
  onValueChange?: (code: string) => void;
  /** Called once every box is filled. */
  onComplete?: (code: string) => void;
  /** Submits the joined code under this name in a <form>. */
  name?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
};

/**
 * One-time code input: one box per digit, auto-advance, backspace moves back,
 * arrow keys move between boxes, and pasting (or SMS autofill) spreads the
 * code across the boxes.
 */
export function OtpInput({
  id,
  label,
  help,
  error,
  length = 6,
  value,
  defaultValue = "",
  onValueChange,
  onComplete,
  name,
  disabled,
  autoFocus,
  className,
}: OtpInputProps) {
  const ids = useFieldIds(id, { help, error });
  const labelId = useId();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [slots, setSlots] = useState(() =>
    toSlots(value ?? defaultValue, length),
  );

  // A new `value` from the parent (e.g. cleared after "resend code") resets
  // the boxes. Adjusting state during render avoids an extra effect pass.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== undefined && value !== slots.join("")) {
      setSlots(toSlots(value, length));
    }
  }

  const focusBox = (index: number) => {
    const box = refs.current[Math.max(0, Math.min(index, length - 1))];
    box?.focus();
    box?.select();
  };

  const commit = (next: string[]) => {
    setSlots(next);
    const code = next.join("");
    onValueChange?.(code);
    if (next.every(Boolean)) onComplete?.(code);
  };

  /** Spreads several digits from `from` onwards (a full code starts at box 1). */
  const fill = (from: number, text: string) => {
    const digits = text.replace(/\D/g, "");
    if (!digits) return;
    const start = digits.length >= length ? 0 : from;
    const next = [...slots];
    for (let k = 0; k < digits.length && start + k < length; k++) {
      next[start + k] = digits[k];
    }
    commit(next);
    focusBox(start + digits.length);
  };

  const setSlot = (index: number, digit: string) => {
    const next = [...slots];
    next[index] = digit;
    commit(next);
  };

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 0) {
      if (raw === "") setSlot(index, "");
      return;
    }
    if (digits.length === 1) {
      setSlot(index, digits);
      focusBox(index + 1);
      return;
    }
    // Typed into a filled box with the caret beside the old digit.
    if (digits.length === 2 && slots[index]) {
      const typed = digits[0] === slots[index] ? digits[1] : digits[0];
      setSlot(index, typed);
      focusBox(index + 1);
      return;
    }
    // Several digits at once: autofill or a paste that skipped onPaste.
    fill(index, digits);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent) => {
    switch (event.key) {
      case "Backspace":
        event.preventDefault();
        if (slots[index]) setSlot(index, "");
        else if (index > 0) {
          const next = [...slots];
          next[index - 1] = "";
          commit(next);
          focusBox(index - 1);
        }
        break;
      case "Delete":
        event.preventDefault();
        setSlot(index, "");
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusBox(index - 1);
        break;
      case "ArrowRight":
        event.preventDefault();
        focusBox(index + 1);
        break;
      case "Home":
        event.preventDefault();
        focusBox(0);
        break;
      case "End":
        event.preventDefault();
        focusBox(length - 1);
        break;
      default:
        // Typing the digit a box already holds leaves its value unchanged,
        // so the browser fires no input event and focus wouldn't move on
        // (the next digit would land in this box). Treat it as typed.
        if (
          event.key === slots[index] &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          event.preventDefault();
          commit([...slots]);
          focusBox(index + 1);
        }
    }
  };

  const handlePaste = (index: number, event: ClipboardEvent) => {
    event.preventDefault();
    fill(index, event.clipboardData.getData("text"));
  };

  return (
    <Field
      ids={ids}
      label={label}
      help={help}
      error={error}
      labelId={labelId}
      className={className}
    >
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={ids.describedBy}
        className="grid max-w-sm gap-2"
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
      >
        {slots.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              refs.current[index] = element;
            }}
            id={index === 0 ? ids.inputId : undefined}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={ui.otp.digitLabel(index + 1, length)}
            aria-invalid={error ? true : undefined}
            disabled={disabled}
            // Only the first box takes focus on mount.
            autoFocus={autoFocus && index === 0}
            value={digit}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            onFocus={(event) => event.target.select()}
            className={cn(
              inputClasses,
              "px-0 text-center text-lg font-bold tabular-nums",
            )}
          />
        ))}
      </div>
      {name && <input type="hidden" name={name} value={slots.join("")} />}
    </Field>
  );
}
