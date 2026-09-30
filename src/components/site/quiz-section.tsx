"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import type { SectionContent } from "@/server/content/home-schema";

type QuizSectionProps = {
  heading: { eyebrow: string | null; title: string | null; titleEmphasis: string | null; description: string | null };
  question: SectionContent<"quiz">["question"];
  badge: string;
  note: string;
};

export function QuizSection({
  heading,
  question,
  badge,
  note,
}: QuizSectionProps) {
  return (
    <section className="section-y bg-gradient-to-r from-orange-soft to-orange-soft/50" id="quiz">
      <div className="shell">
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          titleEmphasis={heading.titleEmphasis}
          description={heading.description}
        />

        <Card interactive className="mt-16">
          <div className="p-8 sm:p-12">
            <div className="mb-6">
              <span className="text-label text-orange-ink uppercase">
                {badge}
              </span>
              <h3 className="text-h2 mt-3">{question.label}</h3>
            </div>

            <div className="rounded-lg border-2 border-orange-ink/20 p-4 sm:p-6 mb-6">
              <p className="text-body-lg font-500">{question.text}</p>
              <div className="text-label text-orange-ink mt-4">
                ⏱ {question.timer}
              </div>
            </div>

            <p className="text-small text-muted mb-6">{note}</p>

            <Button disabled className="w-full sm:w-auto">
              Start
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
