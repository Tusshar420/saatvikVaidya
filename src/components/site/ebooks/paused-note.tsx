import type { ReactNode } from "react";
import { PauseCircle } from "lucide-react";
import { cn } from "@/lib/cn";

/** "Downloads are paused" notice (site-wide or for one book). */
export function PausedNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      role="status"
      className={cn(
        "flex gap-2.5 rounded-lg bg-orange-soft p-3.5 text-sm font-medium text-orange-ink",
        className,
      )}
    >
      <PauseCircle aria-hidden className="mt-0.5 size-4.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
