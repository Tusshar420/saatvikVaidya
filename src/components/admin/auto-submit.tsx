"use client";

import { useEffect, useRef } from "react";

/**
 * Put inside a GET filter form: picking an option in a select or ticking a
 * box applies the filters straight away. Search text still waits for Enter
 * or the button, so typing doesn't reload the page on every key.
 */
export function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onChange = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && target.type === "checkbox")) {
        form.requestSubmit();
      }
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, []);
  return <span ref={ref} hidden />;
}
