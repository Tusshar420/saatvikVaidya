import Link from "next/link";
import { Button, ButtonArrow, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { quiz as copy } from "@/content/quiz";
import { formatDateTime } from "@/lib/format";
import { QUIZ_SECONDS } from "@/lib/quiz";
import type { SectionContent } from "@/server/content/home-schema";
import type { HomeQuiz } from "@/server/quiz/view";

type QuizSectionProps = {
  heading: { eyebrow: string | null; title: string | null; titleEmphasis: string | null; description: string | null };
  badge: SectionContent<"quiz">["badge"];
  note: string;
  /** What is really open (or next): from the quiz schedule, not the seeded sample. */
  live: HomeQuiz;
};

export function QuizSection({ heading, badge, note, live }: QuizSectionProps) {
  return (
    <section className="section-y bg-gradient-to-r from-orange-soft to-orange-soft/50" id="quiz">
      <div className="shell">
        <SectionHeading
          eyebrow={heading.eyebrow}
          title={heading.title}
          emphasis={heading.titleEmphasis}
          description={heading.description}
        />

        <Card interactive className="mt-16">
          <div className="p-8 sm:p-12">
            <div className="mb-6">
              <span className="text-label text-orange-ink uppercase">{badge}</span>
              <h3 className="text-h2 mt-3">{live.kind === "open" ? live.title : copy.home.live}</h3>
            </div>

            <div className="rounded-lg border-2 border-orange-ink/20 p-4 sm:p-6 mb-6">
              {live.kind === "open" && (
                <>
                  <p className="text-body-lg font-500">{copy.facts(live.questionCount, QUIZ_SECONDS / 60)}</p>
                  <div className="text-label text-orange-ink mt-4">{copy.home.endsOn(formatDateTime(live.endsAt))}</div>
                </>
              )}
              {live.kind === "next" && (
                <p className="text-body-lg font-500">{copy.home.next(formatDateTime(live.startsAt))}</p>
              )}
              {live.kind === "none" && <p className="text-body-lg font-500">{copy.home.noneScheduled}</p>}
            </div>

            <p className="text-small text-muted mb-6">{note}</p>

            <div className="flex flex-wrap gap-3 max-sm:*:w-full">
              {live.kind === "open" ? (
                <Link href="/quiz" className={buttonClasses()}>
                  {copy.home.open}
                  <ButtonArrow />
                </Link>
              ) : (
                <Button disabled>{copy.home.open}</Button>
              )}
              <Link href="/quiz/leaderboard" className={buttonClasses({ variant: "secondary" })}>
                {copy.home.leaderboard}
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
