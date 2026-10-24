"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { ui } from "@/content/ui";
import { IconButton } from "./icon-button";

const SWIPE_THRESHOLD_PX = 40;

export type CarouselProps = {
  /** Accessible name, e.g. "Featured offers". */
  label: string;
  slides: readonly ReactNode[];
  /** Auto-advance interval; 0 turns it off. */
  autoAdvanceMs?: number;
  className?: string;
  controlsClassName?: string;
};

/**
 * Cross-fading slides with dots and a pause button; swipe (touch) or drag
 * (mouse) left or right to move between them. It auto-advances (every 6.5 s
 * by default) but pauses on hover, on keyboard focus, when the tab is hidden,
 * and under reduced motion.
 */
export function Carousel({
  label,
  slides,
  autoAdvanceMs = 6500,
  className,
  controlsClassName,
}: CarouselProps) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // null until the user presses pause/play; then their choice wins.
  const [userPlaying, setUserPlaying] = useState<boolean | null>(null);
  const reducedMotion = useReducedMotion();
  const swipeStart = useRef<number | null>(null);
  // Set after a swipe so the click that ends a mouse drag doesn't follow a
  // link or press a button inside the slide.
  const swiped = useRef(false);

  const playing =
    autoAdvanceMs > 0 && count > 1 && (userPlaying ?? !reducedMotion);
  const running = playing && !hovered && !focused;

  const go = (next: number) => setIndex(((next % count) + count) % count);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        setIndex((i) => (i + 1) % count);
      }
    }, autoAdvanceMs);
    return () => window.clearTimeout(timer);
    // `index` restarts the timer after every change, including manual ones.
  }, [running, autoAdvanceMs, count, index]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription={ui.carousel.roleDescription}
      aria-label={label}
      className={cn("relative", className)}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={(event) => {
        if (event.target.matches(":focus-visible")) setFocused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div
        className="grid touch-pan-y select-none"
        aria-live={running ? "off" : "polite"}
        onPointerDown={(event) => {
          swiped.current = false;
          if (event.pointerType === "mouse" && event.button !== 0) return;
          swipeStart.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (swipeStart.current === null) return;
          const delta = event.clientX - swipeStart.current;
          swipeStart.current = null;
          if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
            swiped.current = true;
            go(index + (delta < 0 ? 1 : -1));
          }
        }}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
        onClickCapture={(event) => {
          if (!swiped.current) return;
          swiped.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        // Stops the browser dragging a link or image instead of the slide.
        onDragStart={(event) => event.preventDefault()}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription={ui.carousel.slideRoleDescription}
            aria-label={ui.carousel.slideLabel(i + 1, count)}
            inert={i !== index}
            className={cn(
              "col-start-1 row-start-1 min-w-0 transition-opacity duration-250",
              i === index ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            {slide}
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className={cn("mt-4 flex items-center gap-1", controlsClassName)}>
          <div className="-ml-2.5 flex items-center">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={ui.carousel.goTo(i + 1)}
                aria-current={i === index ? "true" : undefined}
                onClick={() => go(i)}
                className="grid h-11 cursor-pointer place-items-center px-2.5"
              >
                <span
                  aria-hidden
                  className={cn(
                    "block h-1.75 rounded-full transition-all",
                    i === index ? "w-6 bg-orange" : "w-1.75 bg-muted/50",
                  )}
                />
              </button>
            ))}
          </div>
          {autoAdvanceMs > 0 && (
            <IconButton
              label={playing ? ui.carousel.pause : ui.carousel.play}
              variant="ghost"
              shape="round"
              onClick={() => setUserPlaying(!playing)}
              className="ml-1 text-muted"
            >
              {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
            </IconButton>
          )}
        </div>
      )}
    </section>
  );
}
