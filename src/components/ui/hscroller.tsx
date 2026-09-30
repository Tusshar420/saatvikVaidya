"use client";

import { Children, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useScrollEdges } from "@/lib/use-scroll-edges";

export type HScrollerProps = {
  /** Accessible name for the scrolling region. */
  label: string;
  /** Each child becomes one snap item. */
  children: ReactNode;
  /** Width of each item, e.g. "w-[74vw] sm:w-[220px]". */
  itemClassName?: string;
  className?: string;
};

/**
 * A horizontal snap list (reels on phones). The edge that has more content
 * fades out. The region is focusable, so arrow keys scroll it.
 */
export function HScroller({
  label,
  children,
  itemClassName,
  className,
}: HScrollerProps) {
  const { ref, onScroll, style } = useScrollEdges<HTMLDivElement>();

  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      tabIndex={0}
      onScroll={onScroll}
      style={style}
      className={cn(
        "scrollbar-none snap-x snap-mandatory overflow-x-auto overscroll-x-contain focus-visible:outline-offset-4",
        className,
      )}
    >
      <ul className="flex w-max gap-3.5 pb-2">
        {Children.map(children, (child) => (
          <li className={cn("shrink-0 snap-start", itemClassName)}>{child}</li>
        ))}
      </ul>
    </div>
  );
}
