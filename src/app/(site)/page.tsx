import { HeroSection } from "@/components/site/hero-section";
import { CommunitySection } from "@/components/site/community-section";
import { ReelsSection } from "@/components/site/reels-section";
import { LaunchSection } from "@/components/site/launch-section";
import { BrandsSection } from "@/components/site/brands-section";
import { CoursesSection } from "@/components/site/courses-section";
import { CoinsSection } from "@/components/site/coins-section";
import { FeedbackSection } from "@/components/site/feedback-section";
import { TrackSection } from "@/components/site/track-section";
import { WhySection } from "@/components/site/why-section";
import { FinalCtaSection } from "@/components/site/final-cta-section";
import { getHomeContent, type HomeSection } from "@/server/content/home";
import {
  getCoinMaths,
  getHomeQuizCard,
  getLaunchPreview,
  getTopProducts,
} from "@/server/content/home-live";
import { getSession } from "@/server/auth/session";

export const metadata = {
  title: "Saatvik Vaidya",
};

type SectionOf<K extends HomeSection["key"]> = Extract<HomeSection, { key: K }>;

/**
 * The v2 homepage (docs/mockup-v2/index.html), in the mockup's order. Each
 * section's copy and items come from its admin-edited homepage section; a
 * section switched off in the admin is left out. The v1 sections v2 dropped
 * (offers, quick actions, partner) aren't shown, and neither are the trust
 * stats (the client asked for them off the homepage; Why Saatvik shows them).
 */
export default async function HomePage() {
  const [homeContent, session] = await Promise.all([getHomeContent(), getSession()]);
  const userId = session?.user.id ?? null;
  const [quiz, preview, products, coinMaths] = await Promise.all([
    getHomeQuizCard(userId),
    getLaunchPreview(),
    getTopProducts(),
    getCoinMaths(),
  ]);

  const find = <K extends HomeSection["key"]>(key: K) =>
    homeContent.sections.find((s): s is SectionOf<K> => s.key === key);
  const reels = find("reels");
  const launch = find("launch");
  const brands = find("brands");
  const courses = find("courses");
  const coins = find("coins");
  const feedback = find("feedback");
  const why = find("why");
  const signedIn = !!session;

  return (
    <>
      <HeroSection isSignedIn={signedIn} />
      <CommunitySection quiz={quiz} />
      {reels && reels.reels.length > 0 && (
        <ReelsSection heading={reels.heading} filters={reels.filters} reels={reels.reels} />
      )}
      {launch && <LaunchSection heading={launch.heading} steps={launch.steps} preview={preview} />}
      {brands && <BrandsSection heading={brands.heading} products={products} />}
      {courses && (courses.courses.length > 0 || courses.liveSessions.length > 0) && (
        <CoursesSection
          heading={courses.heading}
          courses={courses.courses}
          liveSessions={courses.liveSessions}
        />
      )}
      {coins && <CoinsSection heading={coins.heading} maths={coinMaths} />}
      {feedback && feedback.feedback.length > 0 && (
        <FeedbackSection heading={feedback.heading} feedback={feedback.feedback} />
      )}
      <TrackSection />
      {why && why.steps.length > 0 && <WhySection heading={why.heading} steps={why.steps} />}
      <FinalCtaSection isSignedIn={signedIn} />
    </>
  );
}
