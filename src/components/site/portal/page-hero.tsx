import type { ReactNode } from "react";
import { LabelDot } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { portalPages, type PageHeroCopy } from "@/content/portal-pages";

/**
 * v2 inner-page hero (`.portal-hero`): dark green with the dotted texture and
 * ring, gold kicker, big title, intro, and the "Built for professionals" side
 * note (stacks under the text below 820 px).
 */
export function PageHero({ copy }: { copy: PageHeroCopy }) {
  return (
    <section className="relative overflow-hidden bg-page-hero py-13.5 text-white max-md:py-10.5 max-sm:py-8.75">
      <span aria-hidden className="absolute inset-0 bg-dots" />
      <span
        aria-hidden
        className="absolute -top-32.5 -right-27.5 size-90 rounded-full border-[58px] border-white/5"
      />
      <div className="shell relative flex items-end justify-between gap-9 max-md:flex-col max-md:items-start max-md:gap-6">
        <div className="min-w-0 flex-1">
          <p className="mb-3.5 flex items-center gap-2 text-label text-gold-light uppercase">
            <LabelDot onDark />
            {copy.kicker}
          </p>
          <h1 className="mb-3.5 max-w-[860px] text-h1 text-white">
            {copy.title}
          </h1>
          <p className="max-w-[690px] text-body-lg text-forest-ink max-sm:text-[15px] max-sm:leading-relaxed">
            {copy.description}
          </p>
        </div>
        <aside className="w-[270px] shrink-0 rounded-lg border border-white/16 bg-white/9 p-4.5 max-md:w-full">
          <p className="mb-2 flex items-center gap-2 text-[11px] font-extrabold tracking-[0.1em] text-gold-light uppercase">
            <span
              aria-hidden
              className="size-1.75 shrink-0 rounded-full bg-brand-light ring-4 ring-brand-light/15"
            />
            {portalPages.builtFor}
          </p>
          <p className="font-heading text-base font-extrabold text-white">
            {copy.sideTitle}
          </p>
          <p className="mt-1.5 text-small text-forest-ink">{copy.sideText}</p>
        </aside>
      </div>
    </section>
  );
}

/** The cream page body under a PageHero (`.portal-shell`). */
export function PortalShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="bg-cream">
      <div
        className={cn("shell pt-13.5 pb-24 max-md:pt-9.5 max-md:pb-19 max-sm:pt-7", className)}
      >
        {children}
      </div>
    </div>
  );
}

/** Portal section title: h2 and a short line, optional action on the right. */
export function PortalSectionTitle({
  id,
  title,
  text,
  action,
  className,
}: {
  id?: string;
  title: string;
  text?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mb-5.5 flex items-end justify-between gap-5 max-sm:flex-col max-sm:items-start max-sm:gap-2", className)}
    >
      <div>
        <h2 id={id} className="text-h3 text-ink">
          {title}
        </h2>
        {text && <p className="mt-1.5 text-small text-muted">{text}</p>}
      </div>
      {action}
    </div>
  );
}

/** Pill tab / chip look (`.portal-tabs button`, `.course-filters button`). */
export function pillClasses(active: boolean, className?: string): string {
  return cn(
    "inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-[10px] border px-3.5 text-small font-extrabold whitespace-nowrap transition-colors",
    active
      ? "border-orange-strong bg-orange-strong text-white"
      : "border-line bg-surface text-muted hover:border-brand/40 hover:text-brand",
    className,
  );
}

/** White portal card (`.portal-card`). */
export const portalCardClasses =
  "rounded-xl border border-line bg-surface shadow-card max-sm:rounded-lg";
