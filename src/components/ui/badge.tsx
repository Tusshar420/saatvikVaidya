import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant =
  | "brand"
  | "orange"
  | "blue"
  | "gold"
  | "live"
  | "soon"
  | "success"
  | "dark";

const variantClasses: Record<BadgeVariant, string> = {
  brand: "bg-brand-soft text-brand",
  orange: "bg-orange-soft text-orange-ink",
  blue: "bg-blue-soft text-blue",
  gold: "bg-gold-soft text-gold-ink",
  live: "bg-danger-soft text-danger",
  soon: "border border-orange/50 bg-surface text-orange-ink",
  // "In stock" / "Verified" (`.stock`, `.verified`).
  success: "bg-success-soft text-success",
  // The dark reward pill ("+100 Coins", `.reward-badge`).
  dark: "bg-ink text-white",
};

export type BadgeProps = ComponentProps<"span"> & { variant?: BadgeVariant };

/** Small uppercase label. `live` adds the red dot from the mockup. */
export function Badge({
  variant = "brand",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[11px] leading-none font-extrabold tracking-[0.06em] uppercase",
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
  tone?: "brand" | "light";
};

/** The uppercase label that sits above section and hero titles. */
export function Eyebrow({
  bar = false,
  tone = "brand",
  className,
  children,
  ...props
}: EyebrowProps) {
  return (
    <p
      className={cn(
        "flex items-center gap-2.25 font-heading text-label uppercase",
        tone === "brand" ? "text-brand-mid" : "text-brand-soft",
        className,
      )}
      {...props}
    >
      {bar && <span aria-hidden className="h-0.5 w-7 shrink-0 rounded-full bg-orange" />}
      {children}
    </p>
  );
}
