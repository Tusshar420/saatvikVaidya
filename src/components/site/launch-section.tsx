"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/cn";
import type { CategoryItem } from "@/server/content/home";
import type {
  SectionContent,
} from "@/server/content/home-schema";

type LaunchSectionProps = {
  heading: { eyebrow: string | null; title: string | null; titleEmphasis: string | null; description: string | null };
  steps: SectionContent<"launch">["steps"];
  categories: { form: CategoryItem[]; practiceArea: CategoryItem[] };
  catalogueMeta: SectionContent<"launch">["catalogue"];
};

export function LaunchSection({
  heading,
  steps,
  categories,
  catalogueMeta,
}: LaunchSectionProps) {
  const [activeTab, setActiveTab] = useState<"form" | "practiceArea">("form");
  const activeCategories =
    activeTab === "form" ? categories.form : categories.practiceArea;

  return (
    <section className="section-y bg-cream" id="launch">
      <div className="shell">
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          titleEmphasis={heading.titleEmphasis}
          description={heading.description}
        />

        <div className="mt-16 space-y-12">
          {/* Steps */}
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={index} className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-label text-teal uppercase">
                    Step {index + 1}
                  </div>
                  <h3 className="text-h3 mt-2">{step.title}</h3>
                </div>
                <p className="text-body text-muted sm:mt-2">{step.body}</p>
              </div>
            ))}
          </div>

          {/* Catalogue card */}
          <Card interactive className="overflow-hidden" id="launch-catalogue">
            <div className="p-6 sm:p-8">
              <div className="mb-6">
                <div className="text-label text-orange-ink uppercase">
                  {catalogueMeta.eyebrow || "Catalogue"}
                </div>
                <h3 className="text-h3 mt-2">
                  {catalogueMeta.title || "Explore our products"}
                </h3>
              </div>

              {/* Tab selector */}
              <div className="mb-8 border-b border-line">
                <div className="flex gap-4 sm:gap-8">
                  {[
                    { tab: "form" as const, label: catalogueMeta.formTab },
                    {
                      tab: "practiceArea" as const,
                      label: catalogueMeta.practiceAreaTab,
                    },
                  ].map((tabOption) => (
                    <button
                      key={tabOption.tab}
                      onClick={() => setActiveTab(tabOption.tab)}
                      className={cn(
                        "pb-3 text-body font-500 transition border-b-2 -mb-px",
                        activeTab === tabOption.tab
                          ? "border-teal text-teal"
                          : "border-transparent text-muted hover:text-ink"
                      )}
                    >
                      {tabOption.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category cards grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                {activeCategories.map((category) => (
                  <div
                    key={category.key}
                    className="p-4 rounded-lg border border-line hover:bg-surface-alt transition text-center"
                  >
                    {category.glyph && (
                      <div className="text-3xl mb-2">{category.glyph}</div>
                    )}
                    <h4 className="text-body font-600">{category.name}</h4>
                  </div>
                ))}
              </div>

              <Button
                className="w-full mt-8"
                disabled
                aria-label="Catalogue coming soon"
              >
                {catalogueMeta.categoryLinkLabel || "Explore"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
