import type { SectionHeading as Heading, WhyStepItem } from "@/server/content/home";
import { HomeEyebrow, whyIcons } from "./home-parts";

/** v2 Why Saatvik (`.why-section`): centred intro, then a grid of numbered cards from WhyStep. */
export function WhySection({ heading, steps }: { heading: Heading; steps: WhyStepItem[] }) {
  return (
    <section id="why" aria-labelledby="why-title" className="section-y bg-cream">
      <div className="shell">
        <div className="reveal mx-auto mb-12 max-w-212.5 sm:text-center">
          {heading.eyebrow && <HomeEyebrow className="sm:justify-center">{heading.eyebrow}</HomeEyebrow>}
          <h2 id="why-title" className="m-0 text-h2 text-ink">
            {heading.title}
            {heading.titleEmphasis && (
              <>
                {" "}
                <em className="block text-orange-title not-italic">{heading.titleEmphasis}</em>
              </>
            )}
          </h2>
          {heading.description && (
            <p className="mx-auto mt-5 mb-0 max-w-170 text-sm leading-[1.7] text-muted sm:text-[15px]">
              {heading.description}
            </p>
          )}
        </div>
        <ul className="grid gap-3.75 p-0 sm:grid-cols-2 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = whyIcons[index % whyIcons.length];
            return (
              <li
                key={step.key}
                className="reveal relative min-h-44 overflow-hidden rounded-[19px] border border-line bg-surface p-6.75 transition motion-safe:hover:-translate-y-1 hover:shadow-raised sm:min-h-55"
              >
                <span aria-hidden className="absolute top-4.25 right-4.75 font-heading text-[11px] font-extrabold text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Icon aria-hidden className="mt-1.75 size-8.5 stroke-[1.8] text-orange" />
                <h3 className="mt-4.75 mb-1.75 text-[19px] font-extrabold sm:mt-6.5">{step.title}</h3>
                <p className="m-0 max-w-60 text-small leading-[1.55] text-muted">{step.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
