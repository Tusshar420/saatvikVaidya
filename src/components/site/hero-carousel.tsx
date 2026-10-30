import type { ReactNode } from "react";
import { Carousel } from "@/components/ui/carousel";
import { HeroArt, type HeroArtKind } from "./hero-art";

/**
 * Small text link instead of a full-width button (the client asked for a
 * shorter hero); its `after:` layer stretches over the whole slide, so the
 * slide itself is the tap target.
 */
export const heroSlideLinkClasses =
  "mt-2.5 inline-flex items-center gap-1.5 font-heading text-sm font-bold text-gold-light transition-colors after:absolute after:inset-0 after:content-[''] hover:text-white sm:mt-3 sm:text-base";

export const heroTitleClasses =
  "text-[24px] leading-[1.08] font-extrabold tracking-[-0.04em] sm:text-[36px] sm:leading-[1] lg:text-[clamp(36px,3.5vw,44px)]";

/**
 * The dark green hero band with the slide carousel, shared by the homepage
 * and Quiz & Win. It is only as tall as its tallest slide.
 */
export function HeroCarousel({
  id,
  labelledBy,
  label,
  slides,
}: {
  id?: string;
  /** Id of the first slide's title, which names the whole band. */
  labelledBy: string;
  /** Accessible name of the carousel itself. */
  label: string;
  slides: readonly ReactNode[];
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className="relative overflow-hidden pt-4 text-white bg-hero sm:pt-6 md:pt-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dots"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-45 -right-40 size-110 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-gold)_23%,transparent),transparent_68%)] blur-[2px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-20 -left-42.5 size-92.5 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-orange)_16%,transparent),transparent_70%)] blur-[2px]"
      />

      <Carousel
        label={label}
        autoAdvanceMs={7000}
        className="relative"
        controlsClassName="shell relative mt-0 pb-1 text-white sm:pb-2"
        slides={slides}
      />
    </section>
  );
}

/** One slide: kicker across the top, text on the left, art on the right. */
export function HeroSlide({
  kicker,
  art,
  children,
}: {
  kicker: string;
  art: HeroArtKind;
  children: ReactNode;
}) {
  return (
    <div className="relative shell grid h-full grid-cols-[minmax(0,1fr)_auto] content-center items-center gap-x-3 pt-1 sm:gap-x-8">
      <p className="col-span-2 mb-2 flex self-end sm:col-span-1 items-center gap-2.25 font-heading text-label text-brand-soft uppercase">
        <span aria-hidden className="h-0.5 w-7 shrink-0 rounded-sm bg-orange" />
        {kicker}
      </p>
      <div className="min-w-0 max-w-176 self-start">{children}</div>
      <HeroArt
        kind={art}
        className="size-24 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:size-40 md:size-48 lg:mr-8 lg:size-56"
      />
    </div>
  );
}
