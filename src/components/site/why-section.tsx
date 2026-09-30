"use client";

import { SectionHeading } from "@/components/ui/section-heading";
import type { WhyStepItem } from "@/server/content/home";

type WhySectionProps = {
  heading: { eyebrow: string | null; title: string | null; titleEmphasis: string | null; description: string | null };
  steps: WhyStepItem[];
};

export function WhySection({ heading, steps }: WhySectionProps) {
  return (
    <section className="section-y bg-gradient-to-b from-surface to-surface-alt" id="why">
      <div className="shell">
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          emphasis={heading.titleEmphasis}
          description={heading.description}
        />

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.key}>
              <div className="flex items-baseline gap-3 mb-4">
                <div className="text-display font-800 text-orange leading-none">
                  {index + 1}
                </div>
                <h3 className="text-h3">{step.title}</h3>
              </div>
              <p className="text-body text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
