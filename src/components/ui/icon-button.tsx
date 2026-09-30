import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type IconButtonVariant = "ghost" | "outline" | "soft";

const variantClasses: Record<IconButtonVariant, string> = {
  ghost: "bg-transparent text-ink hover:bg-surface-alt",
  outline: "border border-line-strong bg-white/75 text-teal hover:bg-surface",
  soft: "bg-surface-alt text-muted hover:bg-teal-soft hover:text-teal",
};

export type IconButtonProps = Omit<ComponentProps<"button">, "aria-label"> & {
  /** Required: the button has no visible text. */
  label: string;
  variant?: IconButtonVariant;
  /** `square` has rounded corners; `round` is a circle. */
  shape?: "square" | "round";
};

/** A 44 × 44 button holding one icon. */
export function IconButton({
  label,
  variant = "ghost",
  shape = "square",
  type = "button",
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center transition",
        "disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-5",
        shape === "round" ? "rounded-full" : "rounded-md",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
