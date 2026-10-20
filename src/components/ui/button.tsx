import type { ComponentProps, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "light" | "link";
export type ButtonSize = "md" | "sm";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-orange-strong text-white shadow-cta hover:bg-orange-ink motion-safe:hover:-translate-y-0.5 active:translate-y-0",
  secondary:
    "border border-line-strong bg-white/70 text-brand hover:bg-surface hover:border-brand",
  light: "bg-surface text-brand-dark hover:bg-brand-soft",
  link: "min-h-11 px-1 text-brand underline-offset-4 hover:underline",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "min-h-12 px-5 text-sm",
  sm: "min-h-10 px-4 text-small",
};

export type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

/**
 * Button classes on their own, for links that should look like buttons:
 * `<Link className={buttonClasses({ variant: "secondary" })}>`.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-button font-extrabold whitespace-nowrap transition select-none",
    "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
    sizeClasses[size],
    variantClasses[variant],
    className,
  );
}

/** Trailing "→" used on buttons and button-styled links. */
export function ButtonArrow({ className }: { className?: string }) {
  return (
    <ArrowRight aria-hidden className={cn("size-4 shrink-0", className)} />
  );
}

export type ButtonProps = ComponentProps<"button"> &
  Omit<ButtonStyleOptions, "className"> & {
    /** Adds the trailing arrow icon. */
    arrow?: boolean;
    /** Icon shown before the label. */
    icon?: ReactNode;
    /** Shows a spinner, sets aria-busy and blocks clicks. */
    loading?: boolean;
  };

export function Button({
  variant,
  size,
  arrow = false,
  icon,
  loading = false,
  disabled,
  type = "button",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {arrow && <ButtonArrow />}
    </button>
  );
}

/**
 * Wraps a set of call-to-action buttons. Under 560 px each button takes the
 * full width, as in the mockup's hero CTAs.
 */
export function ButtonGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 max-sm:*:w-full",
        className,
      )}
      {...props}
    />
  );
}
