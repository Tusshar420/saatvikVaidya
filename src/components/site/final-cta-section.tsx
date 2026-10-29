import Link from "next/link";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { home as copy } from "@/content/home";
import { SiteModalButton } from "./site-modals";

const text = copy.finalCta;

/** v2 final CTA (`.final-cta`): "Create Free Profile" opens sign-in. */
export function FinalCtaSection({ isSignedIn }: { isSignedIn: boolean }) {
  const button = buttonClasses({ className: "relative min-h-14 px-6.5 max-sm:w-full" });
  return (
    <section aria-labelledby="final-cta-title" className="bg-surface py-15.5 md:py-22.5">
      <div className="shell reveal relative flex flex-col items-start justify-between gap-7.5 overflow-hidden rounded-[22px] bg-forest px-6.25 py-8.75 text-white sm:rounded-3xl sm:p-12 lg:flex-row lg:items-center lg:px-16 lg:py-14.5">
        <span
          aria-hidden
          className="absolute -top-27.5 -right-22.5 size-82.5 rounded-full border-[55px] border-white/5"
        />
        <div className="relative">
          <span className="font-heading text-[11px] font-extrabold tracking-[0.14em] text-gold-light uppercase">
            {text.kicker}
          </span>
          <h2
            id="final-cta-title"
            className="mt-2.5 mb-3.5 text-[32px] leading-[1.05] font-extrabold tracking-[-0.045em] sm:text-[42px]"
          >
            {text.title}
            <br />
            {text.emphasis}
          </h2>
          <p className="m-0 text-small text-forest-ink">{text.body}</p>
        </div>
        {isSignedIn ? (
          <Link href="/account" className={button}>
            {text.signedIn}
            <ButtonArrow />
          </Link>
        ) : (
          <SiteModalButton modal="signIn" className={button}>
            {text.cta}
            <ButtonArrow />
          </SiteModalButton>
        )}
      </div>
    </section>
  );
}
