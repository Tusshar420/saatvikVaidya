import Link from "next/link";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/cn";
import type { QuickActionItem, SectionHeading as SectionHeadingData } from "@/server/content/home";

export type QuickActionsSectionProps = {
  heading: SectionHeadingData;
  actions: QuickActionItem[];
};

export function QuickActionsSection({
  heading,
  actions,
}: QuickActionsSectionProps) {
  return (
    <section className="section-y">
      <div className="shell">
        <SectionHeading {...heading} />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => (
            <QuickActionCard key={action.key} action={action} />
          ))}
        </div>
      </div>
    </section>
  );
}

function QuickActionCard({ action }: { action: QuickActionItem }) {
  const toneMap: Record<string, { bg: string; icon: string }> = {
    orange: { bg: "bg-orange-soft", icon: "text-orange-ink" },
    teal: { bg: "bg-brand-soft", icon: "text-brand" },
    blue: { bg: "bg-blue-soft", icon: "text-blue" },
    gold: { bg: "bg-gold-soft", icon: "text-gold-ink" },
  };

  const tone = toneMap[action.tone] || toneMap.orange;

  const cardContent = (
    <div className={cn(
      "flex flex-col gap-3 rounded-lg border border-line p-4 transition-all",
      "hover:shadow-raised",
    )}>
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-md text-lg font-700",
          tone.bg,
          tone.icon,
        )}
      >
        {action.iconText}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-small font-700 text-ink">{action.title}</h3>
        <p className="text-small text-muted">{action.description}</p>
      </div>
    </div>
  );

  if (action.href === null) {
    return (
      <span className="block cursor-not-allowed opacity-60">
        {cardContent}
      </span>
    );
  }

  return (
    <Link href={action.href} className="group block">
      {cardContent}
    </Link>
  );
}
