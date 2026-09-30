import { HeroSection } from "@/components/site/hero-section";
import { TrustSection } from "@/components/site/trust-section";
import { ReelsSection } from "@/components/site/reels-section";
import { OffersSection } from "@/components/site/offers-section";
import { QuickActionsSection } from "@/components/site/quick-actions-section";
import { ComingSoon } from "@/components/ui/empty-state";
import { getHomeContent } from "@/server/content/home";

export const metadata = {
  title: "Saatvik Vaidya",
};

export default async function HomePage() {
  const homeContent = await getHomeContent();

  return (
    <>
      {homeContent.sections.map((section) => {
        switch (section.key) {
          case "hero":
            return (
              <section key="hero" id="top" className="section-y">
                <div className="shell">
                  <HeroSection slides={section.slides} />
                </div>
              </section>
            );

          case "trust":
            return <TrustSection key="trust" stats={section.stats} />;

          case "reels":
            return (
              <section key="reels" id="reels" className="section-y">
                <ReelsSection
                  heading={section.heading}
                  filters={section.filters}
                  reels={section.reels}
                />
              </section>
            );

          case "offers":
            return (
              <section key="offers" id="offers" className="section-y">
                <OffersSection
                  heading={section.heading}
                  offers={section.offers}
                />
              </section>
            );

          case "quick-actions":
            return (
              <section key="quick-actions" id="quick-actions" className="section-y">
                <QuickActionsSection
                  heading={section.heading}
                  actions={section.actions}
                />
              </section>
            );

          // Placeholder sections for A8 and later
          case "launch":
          case "brands":
          case "courses":
          case "coins":
          case "quiz":
          case "feedback":
          case "community":
          case "partner":
          case "why":
            return (
              <section
                key={section.key}
                id={section.key}
                className="section-y"
                aria-labelledby={`${section.key}-title`}
              >
                <div className="shell">
                  <div id={`${section.key}-title`} className="mb-8">
                    <ComingSoon
                      as="h2"
                      title={section.heading.title || "Coming soon"}
                    />
                  </div>
                </div>
              </section>
            );

          default:
            return null;
        }
      })}
    </>
  );
}
