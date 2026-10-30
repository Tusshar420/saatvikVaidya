import Link from "next/link";
import { ButtonArrow } from "@/components/ui/button";
import { home as copy } from "@/content/home";
import {
  HeroCarousel,
  HeroSlide,
  heroSlideLinkClasses as slideLinkClasses,
  heroTitleClasses as titleClasses,
} from "./hero-carousel";
import { SiteModalButton } from "./site-modals";

const text = copy.hero;

/**
 * v2 hero (`.hero`): dark green, "Learn. Connect. / Build. Grow." and the
 * slide carousel. The client asked for the stat strip (StatItem rows) to be
 * taken off the hero; those figures still show on Why Saatvik. Each slide has
 * an illustration on the right and no big button, and the hero is only as
 * tall as its tallest slide.
 */
export function HeroSection({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <HeroCarousel
      id="top"
      labelledBy="hero-title"
      label={text.carouselLabel}
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
              <em className="text-gold-light not-italic">{slide.emphasis}</em>
            </h2>
            <Link href={slide.href} className={slideLinkClasses}>
              {slide.cta}
              <ButtonArrow />
            </Link>
          </HeroSlide>
        )),
      ]}
    />
  );
}
