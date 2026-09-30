"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks whether a horizontal scroller is at its start or end, and returns a
 * mask that fades whichever edge has more content. Attach `ref` and
 * `onScroll` to the scrolling element and spread `style` on it.
 */
export function useScrollEdges<T extends HTMLElement>(fade = "40px") {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const onScroll = useCallback(() => {
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
    onScroll();
    const observer = new ResizeObserver(onScroll);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onScroll]);

  const mask = `linear-gradient(to right, ${edges.start ? "black" : "transparent"}, black ${fade}, black calc(100% - ${fade}), ${edges.end ? "black" : "transparent"})`;

  return {
    ref,
    edges,
    onScroll,
    style: { maskImage: mask, WebkitMaskImage: mask },
  };
}
