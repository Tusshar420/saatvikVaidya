import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type CardProps = HTMLAttributes<HTMLElement> & {
  /** Lifts on hover; use when the whole card is a link or button. */
  interactive?: boolean;
  as?: "div" | "article" | "section" | "li";
  /**
   * `default` white; `gold` the Quiz & Win panel (`bg-quiz`); `forest` the
   * dark green card (`bg-forest`, white text).
   */
  tone?: "default" | "gold" | "forest";
};

const toneClasses = {
  default: "border border-line bg-surface shadow-card",
  gold: "bg-quiz text-ink shadow-gold",
  forest: "bg-forest text-white shadow-forest",
} as const;

export function Card({
  interactive = false,
  as: Tag = "div",
  tone = "default",
  className,
  ...props
}: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-xl p-5.5 sm:p-6.5",
        toneClasses[tone],
        interactive &&
          "transition hover:border-brand/40 hover:shadow-raised motion-safe:hover:-translate-y-0.75",
        className,
      )}
      {...props}
    />
  );
}
