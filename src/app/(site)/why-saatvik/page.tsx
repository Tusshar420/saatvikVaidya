import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { PortalShell } from "@/components/site/portal/page-hero";
import { PurposeGrid, StatBand } from "@/components/site/why/why-blocks";
import { EmptyState } from "@/components/ui/empty-state";
import { portalPages } from "@/content/portal-pages";
import { getWhyContent } from "@/server/content/pages";

const copy = portalPages.why;

export const metadata: Metadata = { title: copy.metaTitle };

/**
 * Why Saatvik (U.13): the WhyStep cards and the StatItem band. No dark hero
 * banner (removed at the owner's request, 2026-10-31); the purpose title is the h1.
 */
export default async function WhySaatvikPage() {
  const { steps, stats } = await getWhyContent();
  return (
    <PortalShell>
      <section aria-labelledby="purpose-title">
        <div className="mb-8.75 text-center">
          <p className="mb-3.5 flex items-center justify-center gap-2 text-label text-brand uppercase">
            <span aria-hidden className="h-0.5 w-6 shrink-0 bg-orange" />
            {copy.purposeKicker}
          </p>
          <h1
            id="purpose-title"
            className="font-heading text-[clamp(30px,3.6vw,42px)] leading-[1.08] font-extrabold tracking-[-0.04em] text-balance text-ink"
          >
            {copy.purposeTitle} <br className="max-sm:hidden" />
            {copy.purposeTitleLine2}
          </h1>
        </div>
        {steps.length > 0 ? (
          <PurposeGrid steps={steps} />
        ) : (
          <EmptyState
            icon={<Sparkles aria-hidden />}
            title={copy.emptyTitle}
            description={copy.emptyText}
          />
        )}
      </section>
      {stats.length > 0 && <StatBand stats={stats} label={copy.statsLabel} />}
    </PortalShell>
  );
}
