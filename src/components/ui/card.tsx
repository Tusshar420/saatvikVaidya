import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type CardProps = HTMLAttributes<HTMLElement> & {
  /** Lifts on hover; use when the whole card is a link or button. */
  interactive?: boolean;
  as?: "div" | "article" | "section" | "li";
};

export function Card({
  interactive = false,
  as: Tag = "div",
  className,
  ...props
}: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-xl border border-line bg-surface p-5.5 shadow-card sm:p-6",
        interactive &&
          "transition hover:border-teal/40 hover:shadow-raised motion-safe:hover:-translate-y-0.75",
        className,
      )}
      {...props}
    />
  );
}
