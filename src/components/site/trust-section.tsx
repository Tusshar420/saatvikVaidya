import type { StatItemView } from "@/server/content/home";

export type TrustSectionProps = {
  stats: StatItemView[];
};

export function TrustSection({ stats }: TrustSectionProps) {
  return (
    <section className="bg-brand-dark py-12 md:py-16 lg:py-20">
      <div className="shell">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.key} className="flex flex-col gap-2">
              <p className="text-h2 text-surface">{stat.value}</p>
              <p className="text-small text-surface/90">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
