import type { ReactNode } from "react";
import { LabelDot } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export type LaunchHeroProps = {
  kicker: string;
  title: ReactNode;
  line: ReactNode;
  /** The side note card; `aside` replaces its contents when given. */
  note?: { status: string; title: string; line: string };
  aside?: ReactNode;
};

/**
 * The v2 inner-page hero (`.portal-hero`) for the Build Your Brand pages:
 * dark green with the dotted texture and ring, a gold kicker with an orange
 * bar, the title and line, and the "Built for professionals" side note. Kept
 * shorter than the home hero, so the side note only shows from 820 px up (a
 * page's own `aside` shows everywhere).
 */
export function LaunchHero({
  kicker,
  title,
  line,
  note,
  aside,
}: LaunchHeroProps) {
  return (
    <section className="relative overflow-hidden py-6 text-white bg-page-hero sm:py-7 md:py-8">
      <div aria-hidden className="absolute inset-0 bg-dots" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32.5 -right-27.5 size-90 rounded-full border-[58px] border-white/5"
      />
      <div className="relative shell flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between md:gap-9">
        <div className="min-w-0">
          <p className="mb-2.5 flex items-center gap-2 font-heading text-label text-gold-light uppercase">
            <LabelDot onDark />
            {kicker}
          </p>
          <h1 className="mb-2.5 font-heading text-page-title text-white">{title}</h1>
          <div className="max-w-172.5 text-[15px] leading-[1.6] text-forest-ink max-sm:text-sm">
            {line}
          </div>
        </div>
        {(aside || note) && (
          <aside
            className={cn(
              "shrink-0 rounded-lg border border-white/16 bg-white/9 p-4 md:w-62.5",
              // A page's own `aside` (e.g. the order status) stays on phones.
              aside ? "w-full" : "hidden md:block",
            )}
          >
            {aside ??
              (note && (
                <>
                  <p className="mb-2 flex items-center gap-2 text-[10px] font-extrabold tracking-widest text-gold-light uppercase">
                    <span
                      aria-hidden
                      className="size-1.75 rounded-full bg-brand-light ring-5 ring-brand-light/15"
                    />
                    {note.status}
                  </p>
                  <p className="font-heading text-[15px] font-extrabold text-white">
                    {note.title}
                  </p>
                  <p className="mt-1.5 text-xs leading-normal text-forest-ink">
                    {note.line}
                  </p>
                </>
              ))}
          </aside>
        )}
      </div>
    </section>
  );
}
