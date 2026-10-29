import Link from "next/link";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { home as copy } from "@/content/home";
import type { SectionHeading as Heading } from "@/server/content/home";
import type { LaunchPreview } from "@/server/content/home-live";
import type { SectionContent } from "@/server/content/home-schema";
import { HomeEyebrow } from "./home-parts";
import { LaunchStudio } from "./launch-studio";

type LaunchSectionProps = {
  heading: Heading;
  steps: SectionContent<"launch">["steps"];
  preview: LaunchPreview | null;
};

/** v2 Build Your Brand (`.brand-section`): copy and steps, then the live product preview. */
export function LaunchSection({ heading, steps, preview }: LaunchSectionProps) {
  return (
    <section id="launch" aria-labelledby="launch-title" className="section-y bg-brand-wash">
      <div className="shell grid items-center gap-9 sm:gap-11.25 md:grid-cols-[.84fr_1.16fr] md:gap-9.5 lg:gap-17.5">
        <div className="reveal">
          {heading.eyebrow && <HomeEyebrow>{heading.eyebrow}</HomeEyebrow>}
          <h2 id="launch-title" className="m-0 text-h2 text-ink">
            {heading.title}
            {heading.titleEmphasis && (
              <>
                {" "}
                <em className="block text-orange-title not-italic">{heading.titleEmphasis}</em>
              </>
            )}
          </h2>
          {heading.description && (
            <p className="mt-5 mb-7 text-sm leading-[1.7] text-muted sm:text-[15px]">{heading.description}</p>
          )}
          <ol className="my-7.5 flex flex-col gap-4.25 p-0">
            {steps.map((step, index) => (
              <li key={step.title} className="flex items-center gap-3.5">
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-[11px] border border-line bg-surface font-heading text-xs font-extrabold text-orange-ink"
                >
                  {index + 1}
                </span>
                <p className="m-0 flex flex-col">
                  <b className="text-sm">{step.title}</b>
                  <small className="mt-0.75 text-small text-muted">{step.body}</small>
                </p>
              </li>
            ))}
          </ol>
          <Link
            href={heading.link?.href?.startsWith("/") ? heading.link.href : "/launch"}
            className={buttonClasses({
              className: "bg-brand shadow-none hover:bg-brand-mid max-sm:w-full",
            })}
          >
            {heading.link?.label ?? copy.launch.add}
            <ButtonArrow />
          </Link>
        </div>

        {preview ? (
          <LaunchStudio product={preview} />
        ) : (
          <p className="reveal rounded-2xl border border-line bg-surface p-6 text-muted shadow-raised">
            {copy.launch.empty}
          </p>
        )}
      </div>
    </section>
  );
}
