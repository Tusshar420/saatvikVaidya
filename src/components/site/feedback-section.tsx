import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";
import { ButtonArrow } from "@/components/ui/button";
import { home as copy } from "@/content/home";
import { cn } from "@/lib/cn";
import { hasDevanagari } from "@/lib/detect-hindi";
import type { FeedbackItem, SectionHeading as Heading } from "@/server/content/home";
import { HomeEyebrow } from "./home-parts";

/** v2 Real feedback (`.feedback-section`): intro on the left, the featured quote card on the right. */
export function FeedbackSection({
  heading,
  feedback,
}: {
  heading: Heading;
  feedback: FeedbackItem[];
}) {
  const item = feedback[0];
  const hindi = item ? hasDevanagari(item.quote) : false;
  return (
    <section id="feedback" aria-labelledby="feedback-title" className="section-y bg-surface">
      <div className="shell grid items-center gap-8.75 md:grid-cols-[.78fr_1.22fr] lg:gap-17.5">
        <div className="reveal">
          {heading.eyebrow && <HomeEyebrow>{heading.eyebrow}</HomeEyebrow>}
          <h2 id="feedback-title" className="m-0 text-h2 text-ink">
            {heading.title}
            {heading.titleEmphasis && <span className="block">{heading.titleEmphasis}</span>}
          </h2>
          {heading.description && (
            <p className="mt-5 mb-7 text-sm leading-[1.7] text-muted sm:text-[15px]">{heading.description}</p>
          )}
          <Link
            href="/feedback"
            className="inline-flex min-h-11 items-center gap-2 text-small font-extrabold text-brand hover:underline"
          >
            {heading.link?.label ?? copy.feedback.viewAll}
            <ButtonArrow />
          </Link>
        </div>

        {item && (
          <figure className="reveal relative m-0 rounded-[26px] border border-line bg-cream px-5.75 py-7.75 sm:p-12">
            <span
              aria-hidden
              className="absolute top-4.5 right-8.5 font-serif text-[86px] leading-none font-extrabold text-orange/20"
            >
              “
            </span>
            <blockquote
              lang={hindi ? "hi" : undefined}
              className={cn(
                "relative m-0 mb-8.75 max-w-175 text-lg leading-[1.45] font-semibold tracking-[-0.025em] sm:text-[23px]",
                hindi ? "font-serif-hindi" : "font-heading",
              )}
            >
              {item.quote}
            </blockquote>
            <figcaption className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 sm:flex">
              <a
                href={item.imageSrc}
                target="_blank"
                rel="noreferrer"
                className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-brand text-white"
              >
                <FileText aria-hidden className="size-5" />
                <span className="sr-only">{item.imageAlt}</span>
              </a>
              <span className="flex flex-col">
                <b className="text-small">{item.badge}</b>
                <small className="mt-0.75 text-[11px] text-muted">{item.caption}</small>
              </span>
              <span className="col-start-2 flex items-center gap-1.25 text-[11px] font-extrabold text-brand sm:ml-auto">
                <ShieldCheck aria-hidden className="size-4" />
                {copy.feedback.original}
              </span>
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
