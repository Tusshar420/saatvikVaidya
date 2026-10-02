import Link from "next/link";
import { cn } from "@/lib/cn";
import { shell } from "@/content/shell";

export type LogoProps = {
  /** `light` for the dark footer band. */
  tone?: "default" | "light";
  /** Show the Hindi tagline under the wordmark (hidden on phones anyway). */
  tagline?: boolean;
  className?: string;
};

/** The SV mark and "Saatvik Vaidya" wordmark, linking home. */
export function Logo({
  tone = "default",
  tagline = true,
  className,
}: LogoProps) {
  const light = tone === "light";
  return (
    <Link
      href="/"
      aria-label={shell.brand.homeLabel}
      // Brand colours are a logotype, which WCAG 1.4.3 exempts from contrast
      // minimums; accessibility tests skip [data-logo] for that reason.
      data-logo=""
      className={cn(
        "inline-flex shrink-0 items-center gap-2.5 rounded-md max-[374px]:gap-2",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative grid size-9.75 place-items-center rounded-md text-base font-black tracking-[-1px] text-white shadow-cta bg-brand-mark md:size-11.5 md:rounded-[15px_15px_20px_20px]",
          // The green leaf on the mark's top-right corner.
          "after:absolute after:top-0.5 after:-right-1 after:h-1.75 after:w-3.5 after:-rotate-25 after:rounded-[14px_2px_14px_2px] after:bg-green after:content-['']",
        )}
      >
        {shell.brand.mark}
      </span>
      <span aria-hidden className="flex flex-col leading-[1.1]">
        {/* 15 px below 375 px, so the signed-in header (coins, bag, profile) fits a 360 px phone. */}
        <strong className="text-[17px] font-extrabold tracking-[-0.8px] max-[374px]:text-[15px] sm:text-[19px] md:text-2xl">
          <span className={light ? "text-green-light" : "text-green"}>
            {shell.brand.first}
          </span>{" "}
          <span className={light ? "text-orange-light" : "text-orange"}>
            {shell.brand.second}
          </span>
        </strong>
        {tagline && (
          <small
            className={cn(
              "mt-1.25 text-[11px] whitespace-nowrap max-sm:hidden",
              light ? "text-night-ink" : "text-ink/80",
            )}
          >
            {shell.brand.tagline}
          </small>
        )}
      </span>
    </Link>
  );
}
