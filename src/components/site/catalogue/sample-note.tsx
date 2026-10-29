import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

/** A quiet note that the products shown are sample data. */
export function SampleNote({ children, className }: { children: string; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-line bg-surface-alt px-4 py-3 text-small text-ink",
        className,
      )}
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
      {children}
    </p>
  );
}
