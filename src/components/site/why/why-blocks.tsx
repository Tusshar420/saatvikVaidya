import {
  BookOpen,
  Compass,
  Leaf,
  MessagesSquare,
  ShoppingBag,
  Sprout,
  Star,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/cn";
import type { StatItemView, WhyStepItem } from "@/server/content/home";
import { portalCardClasses } from "../portal/page-hero";

/** Icons for the purpose cards, in turn (the steps carry no icon field). */
const icons: LucideIcon[] = [
  Compass,
  Leaf,
  TrendingUp,
  MessagesSquare,
  BookOpen,
  ShoppingBag,
  Star,
  Sprout,
];

/** Numbered purpose cards (`.purpose-grid`), one per WhyStep. */
export function PurposeGrid({ steps }: { steps: WhyStepItem[] }) {
  return (
    <ol className="grid gap-3.75 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((step, i) => {
        const Icon = icons[i % icons.length];
        return (
          <li
            key={step.key}
            className={cn(
              portalCardClasses,
              "relative min-h-52.5 p-6.25 max-sm:min-h-0",
            )}
          >
            <span
              aria-hidden
              className="absolute top-4.25 right-5 font-heading text-small font-extrabold text-muted/60"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <IconTile tone="brand" size="lg">
              <Icon />
            </IconTile>
            <h3 className="mt-5.25 mb-1.75 text-h4 text-ink">{step.title}</h3>
            <p className="text-small text-muted">{step.body}</p>
          </li>
        );
      })}
    </ol>
  );
}

const columns: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
};

/** Dark green stat band (`.trust-band`) from the StatItem rows. */
export function StatBand({
  stats,
  label,
}: {
  stats: StatItemView[];
  label: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "mt-5.5 grid grid-cols-2 overflow-hidden rounded-lg bg-brand text-white",
        columns[Math.min(stats.length, 6)],
      )}
    >
      {stats.map((s) => (
        <div
          key={s.key}
          className="border-r border-b border-white/12 px-3.25 py-5.25 text-center last:border-r-0 max-md:even:border-r-0 md:border-b-0"
        >
          <p className="font-heading text-lg font-extrabold text-gold-light">
            {s.value}
          </p>
          <p className="mt-1 text-xs text-forest-ink">{s.label}</p>
        </div>
      ))}
    </section>
  );
}
