import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Decorative loading spinner. Pair it with `aria-busy` or visible text; it
 * keeps spinning under reduced motion so it doesn't read as a hang.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden
      data-essential-motion
      className={cn("size-4 shrink-0 animate-spin", className)}
    />
  );
}
