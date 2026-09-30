"use client";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { SiteModalButton } from "./site-modals";
import type { SectionContent } from "@/server/content/home-schema";

type PartnerSectionProps = {
  heading: { eyebrow: string | null; title: string | null; titleEmphasis: string | null; description: string | null };
  completion: SectionContent<"partner">["completion"];
  isSignedIn: boolean;
  profileData?: {
    mobileVerified: boolean;
    userTypeSelected: boolean;
    completionPercent: number;
  };
};

export function PartnerSection({
  heading,
  completion,
  isSignedIn,
  profileData,
}: PartnerSectionProps) {
  const displayPercent = isSignedIn && profileData
    ? profileData.completionPercent
    : completion.examplePercent;

  return (
    <section className="section-y" id="partner">
      <div className="shell">
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          emphasis={heading.titleEmphasis}
          description={heading.description}
        />

        <Card interactive className="mt-16 overflow-hidden">
          <div className="p-8 sm:p-12">
            <div className="mb-8">
              <h3 className="text-h2">{completion.label}</h3>
              <div className="mt-6 flex items-center gap-4">
                <div className="flex-1 bg-line rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-orange transition-all"
                    style={{ width: `${displayPercent}%` }}
                  />
                </div>
                <span className="text-h3 font-600 text-orange-ink">
                  {displayPercent}%
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {completion.steps.map((step) => {
                const isDone = isSignedIn && profileData
                  ? step.key === "mobile" && profileData.mobileVerified
                  : step.exampleDone;

                return (
                  <div
                    key={step.key}
                    className="flex items-center gap-3 p-3 rounded-lg border border-line"
                  >
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-sm font-600 ${
                        isDone
                          ? "bg-green text-white"
                          : "bg-line text-muted"
                      }`}
                    >
                      {isDone ? "✓" : step.key.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body font-500">{step.label}</p>
                      {!isDone && step.key !== "mobile" && (
                        <p className="text-small text-muted">Coming soon</p>
                      )}
                    </div>
                    {isDone && (
                      <div className="text-label font-600 text-green">
                        {step.coins} coins
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-small text-muted mt-6">{completion.note}</p>

            {!isSignedIn && (
              <SiteModalButton
                modal="signIn"
                className="mt-8 w-full sm:w-auto"
              >
                {completion.rewardLabel}
              </SiteModalButton>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}
