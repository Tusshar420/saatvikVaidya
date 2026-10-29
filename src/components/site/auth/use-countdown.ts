"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Seconds left until `start(seconds)` runs out, ticking once a second.
 * Used for the "Resend code in 0:27" timer.
 */
export function useCountdown(): [number, (seconds: number) => void] {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) {
        window.clearInterval(timer);
        setEndsAt(null);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  const start = useCallback((seconds: number) => {
    const current = Date.now();
    setNow(current);
    setEndsAt(current + seconds * 1000);
  }, []);

  const left =
    endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));
  return [left, start];
}
