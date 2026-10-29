"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Leaves out its children on the given paths and everything under them.
 * The layout is a server component that doesn't know the path, so this
 * small client gate decides.
 */
export function HideOnPaths({ paths, children }: { paths: readonly string[]; children: ReactNode }) {
  const pathname = usePathname();
  const hidden = paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  return hidden ? null : children;
}
