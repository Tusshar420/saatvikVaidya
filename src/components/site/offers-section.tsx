import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/cn";
import type { OfferItem, SectionHeading as SectionHeadingData } from "@/server/content/home";

export type OffersSectionProps = {
  heading: SectionHeadingData;
  offers: OfferItem[];
};

export function OffersSection({ heading, offers }: OffersSectionProps) {
  return (
    <section className="section-y">
      <div className="shell">
        <SectionHeading {...heading} />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <OfferCard key={offer.key} offer={offer} />
          ))}
        </div>
      </div>
    </section>
  );
}

function OfferCard({ offer }: { offer: OfferItem }) {
  const bgColorMap: Record<string, string> = {
    orange: "bg-orange-soft border-orange",
    teal: "bg-teal-soft border-teal",
    navy: "bg-blue-soft border-blue",
  };

  const bgClass = bgColorMap[offer.tone] || "bg-surface-alt border-line";
  const iconBgMap: Record<string, string> = {
    orange: "bg-orange text-surface",
    teal: "bg-teal text-surface",
    navy: "bg-blue text-surface",
  };
  const iconBgClass = iconBgMap[offer.tone] || "bg-surface-alt text-ink";

  return (
    <article
      className={cn(
        "flex items-start gap-4 rounded-lg border-2 p-4 md:p-5 transition-shadow hover:shadow-raised",
        bgClass,
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md text-xs font-700",
          iconBgClass,
        )}
      >
        {offer.iconText}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-label uppercase text-muted">{offer.eyebrow}</p>
        <h3 className="text-small font-700 text-ink">{offer.title}</h3>
        <p className="text-small text-muted">{offer.body}</p>
      </div>
      {offer.link.href !== null ? (
        <a
          href={offer.link.href}
          className="text-h2 font-500 text-teal hover:text-teal-dark transition-colors flex-shrink-0"
          aria-label={offer.link.label}
        >
          →
        </a>
      ) : (
        <span className="text-h2 font-500 text-muted flex-shrink-0">→</span>
      )}
    </article>
  );
}
