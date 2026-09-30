"use client";

import { Coins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { SiteModalButton } from "./site-modals";
import type { SectionContent } from "@/server/content/home-schema";

type CoinsSectionProps = {
  heading: { eyebrow: string | null; title: string | null; titleEmphasis: string | null; description: string | null };
  equation: SectionContent<"coins">["equation"];
  isSignedIn: boolean;
};

export function CoinsSection({
  heading,
  equation,
  isSignedIn,
}: CoinsSectionProps) {
  return (
    <section className="section-y bg-gold-soft" id="coins">
      <div className="shell">
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          emphasis={heading.titleEmphasis}
          description={heading.description}
        />

        <Card interactive className="mt-16 overflow-hidden">
          <div className="bg-coin bg-cover bg-center p-8 sm:p-12 lg:p-16">
            <div className="flex items-start gap-4 sm:gap-6">
              <Coins
                aria-hidden
                className="size-12 sm:size-16 flex-shrink-0 text-gold"
              />
              <div>
                <h3 className="text-h2">Saatvik Coins</h3>
                {isSignedIn ? (
                  <>
                    <p className="text-body-lg mt-3 font-600 text-gold-ink">
                      Balance: 0 coins
                    </p>
                    <p className="text-body text-gold-ink/80 mt-2">
                      Earning starts with your first order
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-body-lg mt-3 font-600">
                      {equation.coins}
                    </p>
                    <p className="text-body mt-2">{equation.value}</p>
                    <p className="text-small text-muted mt-2">{equation.note}</p>
                    <SiteModalButton
                      modal="signIn"
                      className="mt-4"
                    >
                      View my rewards
                    </SiteModalButton>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
