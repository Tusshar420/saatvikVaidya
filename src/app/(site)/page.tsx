import { HeroSection } from "@/components/site/hero-section";
import { TrustSection } from "@/components/site/trust-section";
import { ReelsSection } from "@/components/site/reels-section";
import { OffersSection } from "@/components/site/offers-section";
import { QuickActionsSection } from "@/components/site/quick-actions-section";
import { LaunchSection } from "@/components/site/launch-section";
import { BrandsSection } from "@/components/site/brands-section";
import { CoursesSection } from "@/components/site/courses-section";
import { CoinsSection } from "@/components/site/coins-section";
import { QuizSection } from "@/components/site/quiz-section";
import { FeedbackSection } from "@/components/site/feedback-section";
import { CommunitySection } from "@/components/site/community-section";
import { PartnerSection } from "@/components/site/partner-section";
import { WhySection } from "@/components/site/why-section";
import { getHomeContent } from "@/server/content/home";
import { getSession } from "@/server/auth/session";
import { getHomeQuiz } from "@/server/quiz/view";

export const metadata = {
  title: "Saatvik Vaidya",
};

export default async function HomePage() {
  const [homeContent, session, homeQuiz] = await Promise.all([
    getHomeContent(),
    getSession(),
    getHomeQuiz(),
  ]);

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

          case "launch":
            return (
              <LaunchSection
                key="launch"
                heading={section.heading}
                steps={section.steps}
                categories={section.categories}
                catalogueMeta={section.catalogue}
              />
            );

          case "brands":
            return (
              <BrandsSection
                key="brands"
                heading={section.heading}
                brands={section.brands}
              />
            );

          case "courses":
            return (
              <CoursesSection
                key="courses"
                heading={section.heading}
                courses={section.courses}
                liveSessions={section.liveSessions}
              />
            );

          case "coins":
            return (
              <CoinsSection
                key="coins"
                heading={section.heading}
                equation={section.equation}
                isSignedIn={!!session}
              />
            );

          case "quiz":
            return (
              <QuizSection
                key="quiz"
                heading={section.heading}
                badge={section.badge}
                note={section.note}
                live={homeQuiz}
              />
            );

          case "feedback":
            return (
              <FeedbackSection
                key="feedback"
                heading={section.heading}
                feedback={section.feedback}
              />
            );

          case "community":
            return (
              <CommunitySection
                key="community"
                heading={section.heading}
                points={section.points}
              />
            );

          case "partner":
            return (
              <PartnerSection
                key="partner"
                heading={section.heading}
                completion={section.completion}
                isSignedIn={!!session}
                profileData={
                  session
                    ? {
                        mobileVerified: session.user.phoneNumberVerified ?? false,
                        userTypeSelected: !!session.user.userTypeId,
                        completionPercent: 40,
                      }
                    : undefined
                }
              />
            );

          case "why":
            return (
              <WhySection
                key="why"
                heading={section.heading}
                steps={section.steps}
              />
            );

          default:
            return null;
        }
      })}
    </>
  );
}
