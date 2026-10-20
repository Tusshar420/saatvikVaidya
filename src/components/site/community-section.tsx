"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import type { SectionContent } from "@/server/content/home-schema";

type CommunitySectionProps = {
  heading: { eyebrow: string | null; title: string | null; titleEmphasis: string | null; description: string | null };
  points: SectionContent<"community">["points"];
};

export function CommunitySection({
  heading,
  points,
}: CommunitySectionProps) {
  return (
    <section className="section-y bg-brand-dark" id="community">
      <div className="shell">
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          emphasis={heading.titleEmphasis}
          description={heading.description}
          tone="dark"
        />

        <Card interactive className="mt-16 bg-brand/10">
          <div className="p-8 sm:p-12">
            <div className="space-y-4">
              {points.map((point, index) => (
                <div key={index} className="flex gap-4">
                  <div className="text-h2 text-brand flex-shrink-0">✓</div>
                  <p className="text-body text-white">{point}</p>
                </div>
              ))}
            </div>

            <Button
              disabled
              variant="light"
              className="mt-8 w-full sm:w-auto"
            >
              Join Community
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
