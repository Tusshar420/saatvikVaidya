"use client";

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

const FADE = "40px";

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
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft <= 1;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setEdges((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end },
    );
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const mask = `linear-gradient(to right, ${edges.start ? "black" : "transparent"}, black ${FADE}, black calc(100% - ${FADE}), ${edges.end ? "black" : "transparent"})`;

  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      tabIndex={0}
      onScroll={measure}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
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
