import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/format";

export type AvatarSize = "sm" | "md" | "lg";

const sizeClasses: Record<AvatarSize, string> = {
  sm: "size-8 rounded-[9px] text-[11px]",
  md: "size-8.75 rounded-[11px] text-xs",
  lg: "size-12 rounded-[14px] text-base",
};

export type AvatarProps = {
  name: string;
  size?: AvatarSize;
  /** Hide from screen readers when the name is already next to it. */
  decorative?: boolean;
  className?: string;
};

/** The user's initials on teal. */
export function Avatar({
  name,
  size = "md",
  decorative = false,
  className,
}: AvatarProps) {
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      className={cn(
        "inline-grid shrink-0 place-items-center bg-teal font-extrabold text-white select-none",
        sizeClasses[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
