import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonArrow } from "@/components/ui/button";
import { home as copy } from "@/content/home";
import { Carousel } from "@/components/ui/carousel";
import { HeroArt, type HeroArtKind } from "./hero-art";
import { SiteModalButton } from "./site-modals";

const text = copy.hero;

/**
 * Small text link instead of a full-width button (the client asked for a
 * shorter hero); its `after:` layer stretches over the whole slide, so the
 * slide itself is the tap target.
 */
const slideLinkClasses =
  "mt-2.5 inline-flex items-center gap-1.5 font-heading text-sm font-bold text-gold-light transition-colors after:absolute after:inset-0 after:content-[''] hover:text-white sm:mt-3 sm:text-base";

/**
 * v2 hero (`.hero`): dark green, "Learn. Connect. / Build. Grow." and the
 * slide carousel. The client asked for the stat strip (StatItem rows) to be
 * taken off the hero; those figures still show on Why Saatvik. Each slide has
 * an illustration on the right and no big button, and the hero is only as
 * tall as its tallest slide.
 */
export function HeroSection({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
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
        label={text.carouselLabel}
        autoAdvanceMs={7000}
        className="relative"
        controlsClassName="shell relative mt-0 pb-1 text-white sm:pb-2"
        slides={[
          <HeroSlide key="intro" kicker={text.eyebrow} art="intro">
            <h1 id="hero-title" className={titleClasses}>
              {text.title}
              <br />
              <em className="text-gold-light not-italic">{text.emphasis}</em>
            </h1>
            {isSignedIn ? (
              <Link href="/account" className={slideLinkClasses}>
                {text.join}
                <ButtonArrow />
              </Link>
            ) : (
              <SiteModalButton
                modal="signIn"
                className={`${slideLinkClasses} cursor-pointer`}
              >
                {text.join}
                <ButtonArrow />
              </SiteModalButton>
            )}
          </HeroSlide>,
          ...text.slides.map((slide) => (
            <HeroSlide key={slide.key} kicker={slide.kicker} art={slide.key}>
              <h2 className={titleClasses}>
                {slide.title}
                <br />
                <em className="text-gold-light not-italic">
                  {slide.emphasis}
                </em>
              </h2>
              <Link href={slide.href} className={slideLinkClasses}>
                {slide.cta}
                <ButtonArrow />
              </Link>
            </HeroSlide>
          )),
        ]}
      />
    </section>
  );
}

const titleClasses =
  "text-[24px] leading-[1.08] font-extrabold tracking-[-0.04em] sm:text-[36px] sm:leading-[1] lg:text-[clamp(36px,3.5vw,44px)]";

/** One slide: kicker across the top, text on the left, art on the right. */
function HeroSlide({
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
