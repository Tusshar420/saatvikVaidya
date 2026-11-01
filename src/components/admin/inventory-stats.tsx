import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A row of label/value tiles. `warn` tints a tile that needs attention;
 * `href` makes a tile a shortcut to the matching filtered list.
 */
export function InventoryStats({
  stats,
  label,
}: {
  stats: { label: string; value: string; warn?: boolean; href?: string }[];
  label: string;
}) {
  return (
    <ul aria-label={label} className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.map((stat) => {
        const body = (
          <>
            <p className="flex items-center justify-between gap-2 text-small font-bold text-muted">
              {stat.label}
              {stat.href && <ChevronRight aria-hidden className="size-4 shrink-0" />}
            </p>
            <p className={cn("mt-1 text-2xl font-extrabold tracking-[-0.03em]", stat.warn ? "text-orange-ink" : "text-ink")}>
              {stat.value}
            </p>
          </>
        );
        const box = cn("block h-full rounded-xl border bg-surface p-4 shadow-card", stat.warn ? "border-orange/60" : "border-line");
        return (
          <li key={stat.label}>
            {stat.href ? (
              <Link href={stat.href} className={cn(box, "transition hover:border-brand hover:shadow-raised")}>
                {body}
              </Link>
            ) : (
              <div className={box}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
