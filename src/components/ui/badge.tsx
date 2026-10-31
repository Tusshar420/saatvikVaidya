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

/**
 * The small green dot with a soft ring that leads an eyebrow label (it
 * replaced the short orange line, 2026-10-31). `onDark` for dark sections.
 */
export function LabelDot({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.75 shrink-0 rounded-full ring-4",
        onDark ? "bg-brand-light ring-brand-light/15" : "bg-brand-mid ring-brand-mid/15",
        className,
      )}
    />
  );
}

export type EyebrowProps = ComponentProps<"p"> & {
  /** Green dot before the text, as on the hero. */
  dot?: boolean;
  /** `light` for dark sections. */
  tone?: "brand" | "light";
};

/** The uppercase label that sits above section and hero titles. */
export function Eyebrow({
  dot = false,
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
      {dot && <LabelDot onDark={tone === "light"} />}
      {children}
    </p>
  );
}
