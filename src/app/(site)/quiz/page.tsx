import type { Metadata } from "next";
import Link from "next/link";
import { HeroCarousel, HeroSlide, heroCompactTitleClasses, heroSlideLinkClasses } from "@/components/site/hero-carousel";
import { quizCardClass } from "@/components/site/quiz/quiz-challenge";
import { QuizGrid } from "@/components/site/quiz/quiz-grid";
import { SideLeaderboard } from "@/components/site/quiz/side-leaderboard";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { quiz as copy } from "@/content/quiz";
import { getSession } from "@/server/auth/session";
import { listQuizGroups, readLeaderboard } from "@/server/quiz/view";
import { boardOf } from "./params";

export const metadata: Metadata = { title: copy.metaTitle };

/**
 * Quiz & Win (P2.3, v2 look in U.10), under a two-slide hero carousel like
 * the homepage's. The open and upcoming quizzes show as boxes grouped by
 * category (each box opens /quiz/[id] to play); the side card is the real
 * weekly or monthly leaderboard.
 */
export default async function QuizPage({ searchParams }: PageProps<"/quiz">) {
  const period = boardOf((await searchParams).board);
  const session = await getSession();
  const userId = session?.user.id ?? null;
  const [groups, board] = await Promise.all([listQuizGroups(userId), readLeaderboard(period, userId)]);
  const hero = copy.carousel;

  return (
    <>
      <HeroCarousel
        labelledBy="quiz-hero-title"
        label={hero.label}
        compact
        slides={[
          <HeroSlide key="play" kicker={hero.play.kicker} art="quiz" compact>
            <h1 id="quiz-hero-title" className={heroCompactTitleClasses}>
              {hero.play.title}
              <br />
              <em className="text-gold-light not-italic">{hero.play.emphasis}</em>
            </h1>
            <Link href="#quizzes" className={heroSlideLinkClasses}>
              {groups.length === 0 ? hero.play.ctaNone : hero.play.cta}
              <ButtonArrow />
            </Link>
          </HeroSlide>,
          <HeroSlide key="board" kicker={hero.board.kicker} art="podium" compact>
            <p className={heroCompactTitleClasses}>
              {hero.board.title}
              <br />
              <em className="text-gold-light not-italic">{hero.board.emphasis}</em>
            </p>
            <Link href="/quiz/leaderboard" className={heroSlideLinkClasses}>
              {hero.board.cta}
              <ButtonArrow />
            </Link>
          </HeroSlide>,
        ]}
      />

      <div className="bg-cream pt-7 pb-19 sm:pt-9.5 md:pt-13.5 md:pb-24">
        <div className="shell grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
          <div id="quizzes" className="min-w-0 scroll-mt-28">
            {groups.length > 0 ? (
              <QuizGrid groups={groups} />
            ) : (
              <section aria-labelledby="quiz-none" className={quizCardClass}>
                <h2 id="quiz-none" className="font-heading text-[20px] leading-[1.35] font-extrabold tracking-[-0.025em] text-ink sm:text-[24px]">
                  {copy.none.title}
                </h2>
                <p className="mt-2 text-body text-muted">{copy.none.noneScheduled}</p>
                <div className="mt-5.5">
                  <Link href="/quiz/leaderboard" className={buttonClasses({ variant: "secondary", className: "max-sm:w-full" })}>
                    {copy.home.leaderboard}
                  </Link>
                </div>
              </section>
            )}
          </div>

          <SideLeaderboard board={board} path="/quiz" />
        </div>
      </div>
    </>
  );
}
