import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant =
  "teal" | "orange" | "blue" | "gold" | "live" | "soon";

const variantClasses: Record<BadgeVariant, string> = {
  teal: "bg-teal-soft text-teal",
  orange: "bg-orange-soft text-orange-ink",
  blue: "bg-blue-soft text-blue",
  gold: "bg-gold-soft text-gold-ink",
  live: "bg-danger-soft text-danger",
  soon: "border border-orange/50 bg-surface text-orange-ink",
};

export type BadgeProps = ComponentProps<"span"> & { variant?: BadgeVariant };

/** Small uppercase label. `live` adds the red dot from the mockup. */
export function Badge({
  variant = "teal",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-sm px-2 py-1 text-label uppercase",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {variant === "live" && (
        <span
          aria-hidden
          className="size-1.75 shrink-0 rounded-full bg-live-dot ring-4 ring-live-dot/15"
        />
      )}
      {children}
    </span>
  );
}

export type EyebrowProps = ComponentProps<"p"> & {
  /** Short orange bar before the text, as on the hero. */
  bar?: boolean;
  /** `light` for dark sections. */
  tone?: "teal" | "light";
};

/** The uppercase label that sits above section and hero titles. */
export function Eyebrow({
  bar = false,
  tone = "teal",
  className,
  children,
  ...props
}: EyebrowProps) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-label uppercase",
        tone === "teal" ? "text-teal" : "text-teal-soft",
        className,
      )}
      {...props}
    >
      {bar && <span aria-hidden className="h-0.5 w-6 shrink-0 bg-orange" />}
      {children}
    </p>
  );
}
