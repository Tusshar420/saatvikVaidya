"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { sectionOf } from "@/lib/page-sections";

/**
 * Counts each page opened on the public site for Traffic (/admin/traffic).
 * Sent after the page has rendered and never awaited, so it can't slow a
 * page or break it. No cookie is set. Renders nothing.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || !sectionOf(pathname)) return;
    try {
      void fetch("/api/page-views", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: pathname }),
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // Counting must never cause an error of its own.
    }
  }, [pathname]);
  return null;
}
