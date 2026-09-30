"use client";

import Link from "next/link";
import { Carousel } from "@/components/ui/carousel";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { hasDevanagari } from "@/lib/detect-hindi";
import type { HeroSlideItem } from "@/server/content/home";
import type { HeroPanel } from "@/server/content/home";

export type HeroSectionProps = {
  slides: HeroSlideItem[];
};

export function HeroSection({ slides }: HeroSectionProps) {
  return (
    <Carousel
      label="Featured updates"
      slides={slides.map((slide) => (
        <div
          key={slide.key}
          className="grid items-center gap-8 py-12 md:gap-12 lg:grid-cols-2 lg:py-16"
        >
          {/* Left side: copy and CTAs */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-label uppercase text-teal">
                {slide.eyebrow}
              </span>
              <h1 className="text-display text-ink">
                {slide.title}
                {slide.titleEmphasis && (
                  <>
                    <br />
                    <em className="text-teal not-italic">{slide.titleEmphasis}</em>
                  </>
                )}
              </h1>
            </div>
            <p className="max-w-sm text-body-lg text-muted">{slide.body}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {slide.primary.href !== null ? (
                <Link
                  href={slide.primary.href}
                  className={buttonClasses({ variant: "primary" })}
                >
                  {slide.primary.label}
                </Link>
              ) : (
                <button
                  disabled
                  className={buttonClasses({ variant: "primary" })}
                  title={`${slide.primary.label} (coming soon)`}
                >
                  {slide.primary.label}
                </button>
              )}
              {slide.secondary && (
                <>
                  {slide.secondary.href !== null ? (
                    <Link
                      href={slide.secondary.href}
                      className={buttonClasses({ variant: "secondary" })}
                    >
                      {slide.secondary.label}
                    </Link>
                  ) : (
                    <button
                      disabled
                      className={buttonClasses({ variant: "secondary" })}
                      title={`${slide.secondary.label} (coming soon)`}
                    >
                      {slide.secondary.label}
                    </button>
                  )}
                </>
              )}
            </div>
            {slide.proof && (
              <div className="flex items-start gap-4 pt-4">
                <div className="flex -space-x-3">
                  {slide.proof.initials.map((initial, i) => (
                    <div
                      key={i}
                      className="flex h-10 w-10 items-center justify-center rounded-md border-2 border-surface bg-teal text-sm font-700 text-surface"
                    >
                      {initial}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-small font-700 text-ink">{slide.proof.title}</p>
                  <p className="text-small text-muted">{slide.proof.subtitle}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right side: panel */}
          <HeroPanelRenderer panel={slide.panel} />
        </div>
      ))}
      autoAdvanceMs={6500}
      controlsClassName="justify-center md:justify-end md:mt-8"
    />
  );
}

function HeroPanelRenderer({ panel }: { panel: HeroPanel }) {
  if (panel.kind === "LAUNCH_STUDIO") {
    return <LaunchStudioPanel panel={panel} />;
  } else if (panel.kind === "BRAND_SHOWCASE") {
    return <BrandShowcasePanel panel={panel} />;
  } else if (panel.kind === "LEARNING_BOARD") {
    return <LearningBoardPanel panel={panel} />;
  }
  return null;
}

function LaunchStudioPanel({
  panel,
}: {
  panel: HeroPanel & { kind: "LAUNCH_STUDIO" };
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-alt p-6 shadow-card md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded text-xs font-700 text-orange">
            ●
          </span>
          <span className="text-small font-700 text-ink">{panel.label}</span>
        </div>
        <span className="text-small text-muted">{panel.step}</span>
      </div>

      <h2 className="mb-4 text-h3 text-ink">{panel.title}</h2>

      <div className="mb-4 flex items-center gap-2 rounded-md border border-line bg-surface px-4 py-3">
        <svg
          className="h-5 w-5 text-muted"
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path d="m21 21-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
        </svg>
        <span className="text-body text-muted">{panel.searchPlaceholder}</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {panel.pills.map((pill: string) => (
          <button
            key={pill}
            onClick={() => {}}
            className={cn(
              "rounded-sm border px-3 py-1.5 text-small font-500 transition-colors",
              pill === panel.selectedPill
                ? "border-orange bg-surface text-orange"
                : "border-line bg-surface text-muted hover:text-ink",
            )}
          >
            {pill}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-md border border-line bg-surface p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded text-xs font-700 text-teal">
          {panel.product.symbol}
        </div>
        <div className="flex-1">
          <p className="text-small font-700 text-ink">{panel.product.name}</p>
          <p className="text-small text-muted">{panel.product.meta}</p>
        </div>
      </div>

      <div className="mb-4 space-y-2 border-t border-line pt-3">
        {panel.meta.map((item: { label: string; value: string }) => (
          <div key={item.label} className="flex justify-between">
            <span className="text-small text-muted">{item.label}</span>
            <span className="text-small font-500 text-ink">{item.value}</span>
          </div>
        ))}
      </div>

      {panel.nextHref !== null ? (
        <Link
          href={panel.nextHref}
          className={buttonClasses({ variant: "primary", className: "mb-3 w-full" })}
        >
          {panel.nextLabel}
        </Link>
      ) : (
        <button
          disabled
          className={buttonClasses({ variant: "primary", className: "mb-3 w-full" })}
          title={`${panel.nextLabel} (coming soon)`}
        >
          {panel.nextLabel}
        </button>
      )}

      <p className="text-small text-muted">
        <span className="mr-1">✓</span>
        {panel.note}
      </p>
    </div>
  );
}

function BrandShowcasePanel({
  panel,
}: {
  panel: HeroPanel & { kind: "BRAND_SHOWCASE" };
}) {
  return (
    <div className="relative flex flex-col gap-4">
      <span className="absolute -top-4 right-0 text-small font-500 text-muted">
        {panel.floatLabel}
      </span>

      {/* Featured brand card */}
      <div className="rounded-xl border-2 border-teal bg-teal-soft p-5">
        <p className="mb-2 text-label uppercase text-teal">
          {panel.featured.eyebrow}
        </p>
        <h3 className="mb-2 text-h3 text-ink">{panel.featured.name}</h3>
        <p className="mb-4 text-body text-muted">{panel.featured.description}</p>
        {panel.featured.linkHref !== null ? (
          <Link
            href={panel.featured.linkHref}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            {panel.featured.linkLabel}
          </Link>
        ) : (
          <button
            disabled
            className={buttonClasses({ variant: "secondary", size: "sm" })}
            title={`${panel.featured.linkLabel} (coming soon)`}
          >
            {panel.featured.linkLabel}
          </button>
        )}
      </div>

      {/* Other brands */}
      <div className="grid gap-3 sm:grid-cols-2">
        {panel.others.map((brand: { name: string; description: string }) => (
          <div key={brand.name} className="rounded-lg border border-line bg-surface p-4">
            <p className="text-small font-700 text-ink">{brand.name}</p>
            <p className="text-small text-muted">{brand.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LearningBoardPanel({
  panel,
}: {
  panel: HeroPanel & { kind: "LEARNING_BOARD" };
}) {
  return (
    <div className="rounded-xl bg-learning p-6 text-surface md:p-8">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-danger text-xs font-700 text-surface">
          ●
        </span>
        <span className="text-label font-700 text-surface">{panel.badge}</span>
      </div>

      <h2 className="mb-2 text-h3 text-surface">{panel.title}</h2>
      <p
        className={cn("mb-6 text-body", {
          "font-serif-hindi": hasDevanagari(panel.subtitle),
        })}
        lang={hasDevanagari(panel.subtitle) ? "hi" : undefined}
      >
        {panel.subtitle}
      </p>

      <div className="mb-6 space-y-3">
        {panel.meta.map((item: { label: string; value: string }) => (
          <div key={item.label} className="flex justify-between">
            <span className="text-small text-surface/90">{item.label}</span>
            <span className="text-small font-700 text-surface">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded text-xs font-700 text-learning bg-surface">
          {panel.speaker.initials}
        </div>
        <div>
          <p className="text-small font-700 text-surface">{panel.speaker.name}</p>
          <p className="text-small text-surface/90">{panel.speaker.role}</p>
        </div>
      </div>

      {panel.linkHref !== null ? (
        <Link
          href={panel.linkHref}
          className={buttonClasses({ variant: "light" })}
        >
          {panel.linkLabel}
        </Link>
      ) : (
        <button
          disabled
          className={buttonClasses({ variant: "light" })}
          title={`${panel.linkLabel} (coming soon)`}
        >
          {panel.linkLabel}
        </button>
      )}
    </div>
  );
}
