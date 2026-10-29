import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type IconTileTone = "orange" | "brand" | "blue" | "gold";

const toneClasses: Record<IconTileTone, string> = {
  orange: "bg-orange-soft text-orange-ink",
  brand: "bg-brand-soft text-brand",
  blue: "bg-blue-soft text-blue",
  gold: "bg-gold-soft text-gold-ink",
};

export type IconTileProps = ComponentProps<"span"> & {
  tone?: IconTileTone;
  size?: "md" | "lg";
  /** Gives the tile an accessible name; without it the tile is decorative. */
  label?: string;
};

/** A soft-tinted rounded square holding an icon (quick actions, modals). */
export function IconTile({
  tone = "brand",
  size = "md",
  label,
  className,
  ...props
}: IconTileProps) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "grid shrink-0 place-items-center rounded-button text-xs font-black",
        size === "md" ? "size-10.75 [&_svg]:size-5" : "size-12 [&_svg]:size-6",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
