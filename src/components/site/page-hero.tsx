import type { ReactNode } from "react";
import { LabelDot } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export type PageHeroProps = {
  /** Gold uppercase eyebrow led by the green dot. */
  eyebrow: string;
  title: ReactNode;
  /** `p` when the page's h1 sits further down (e.g. the quiz title in its card). */
  titleAs?: "h1" | "p";
  description?: ReactNode;
  /** The "BUILT FOR PROFESSIONALS" side note: its small status line, title and text. */
  note?: { status: string; title: ReactNode; text?: ReactNode };
  className?: string;
  children?: ReactNode;
};

/**
 * Inner-page hero (v2 `.portal-hero`): dark green gradient with the dotted
 * texture and a faint ring, gold eyebrow, title, description, and a glassy
 * side note card. The client asked for it to stay shorter than the home hero,
 * so the side note is left out on phones (its facts repeat on the page).
 */
export function PageHero({ eyebrow, title, titleAs: Title = "h1", description, note, className, children }: PageHeroProps) {
  return (
    <section className={cn("relative isolate overflow-hidden bg-page-hero py-6 text-white sm:py-7 md:py-8", className)}>
      <div aria-hidden className="absolute inset-0 -z-10 bg-dots" />
      <div
        aria-hidden
        className="absolute -top-32.5 -right-27.5 -z-10 size-90 rounded-full border-[58px] border-white/5"
      />
      <div className="shell flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between md:gap-9">
        <div className="min-w-0">
          <p className="mb-2.5 flex items-center gap-2 font-heading text-label text-gold-light uppercase">
            <LabelDot onDark />
            {eyebrow}
          </p>
          <Title className="mb-2.5 font-heading text-page-title text-balance">{title}</Title>
          {description && (
            <p className="max-w-172.5 text-sm leading-[1.6] text-forest-ink sm:text-body">{description}</p>
          )}
          {children}
        </div>
        {note && (
          <aside className="hidden rounded-lg border border-white/16 bg-white/9 p-4 md:block md:w-62.5 md:flex-none">
            <p className="mb-2 flex items-center gap-2 text-label text-gold-light uppercase">
              <span aria-hidden className="size-1.75 shrink-0 rounded-full bg-brand-light ring-4 ring-brand-light/15" />
              {note.status}
            </p>
            <p className="font-heading text-[15px] font-extrabold text-white">{note.title}</p>
            {note.text && <p className="mt-1.5 text-small leading-normal text-forest-ink">{note.text}</p>}
          </aside>
        )}
      </div>
    </section>
  );
}
