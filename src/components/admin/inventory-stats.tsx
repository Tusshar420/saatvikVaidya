import { cn } from "@/lib/cn";

/** A row of label/value tiles. `warn` tints a tile that needs attention. */
export function InventoryStats({
  stats,
  label,
}: {
  stats: { label: string; value: string; warn?: boolean }[];
  label: string;
}) {
  return (
    <ul aria-label={label} className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <li
          key={stat.label}
          className={cn(
            "rounded-xl border bg-surface p-4 shadow-card",
            stat.warn ? "border-orange/60" : "border-line",
          )}
        >
          <p className="text-small font-bold text-muted">{stat.label}</p>
          <p className={cn("mt-1 text-2xl font-extrabold tracking-[-0.03em]", stat.warn ? "text-orange-ink" : "text-ink")}>
            {stat.value}
          </p>
        </li>
      ))}
    </ul>
  );
}
