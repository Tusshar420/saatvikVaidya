import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ButtonArrow } from "@/components/ui/button";
import { home as copy } from "@/content/home";
import { formatDateTime } from "@/lib/format";
import type { HomeQuizCard } from "@/server/content/home-live";
import { HomeHead, homeIcons } from "./home-parts";

const text = copy.community;

/**
 * v2 "Start with the community" (`.community-first`): the Dr. Talk card
 * (Coming next until discussions launch) and the gold Quiz & Win card with
 * the current quiz's real numbers.
 */
export function CommunitySection({ quiz }: { quiz: HomeQuizCard }) {
  const TalkIcon = homeIcons.talk;
  const QuizIcon = homeIcons.quiz;
  const { live } = quiz;
  const questions = live.kind === "open" ? live.questionCount : 10;
  const bestPercent = quiz.you ? Math.round((quiz.you.score / quiz.you.maxScore) * 100) : 0;

  return (
    <section id="explore" className="section-y bg-cream">
      <div className="shell">
        <HomeHead
          eyebrow={text.eyebrow}
          title={text.title}
          emphasis={text.emphasis}
          description={text.body}
        />

        <div className="grid gap-5.5 md:grid-cols-[1.1fr_.9fr]">
          <article
            id="doctor-talk"
            className="reveal relative overflow-hidden rounded-[20px] border border-line bg-surface p-5.5 shadow-raised sm:rounded-xl sm:p-7 lg:p-8.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-heading text-xs font-extrabold tracking-[0.14em] text-muted">
                {text.talk.number}
              </span>
              <span className="flex items-center gap-1.5 rounded-sm bg-success-soft px-2.5 py-1.75 text-[11px] font-extrabold text-brand">
                <ShieldCheck aria-hidden className="size-3.5" />
                {text.talk.verified}
              </span>
            </div>
            <span
              aria-hidden
              className="mt-6 grid size-12.25 place-items-center rounded-[17px] bg-brand-soft text-brand sm:mt-8 sm:size-14"
            >
              <TalkIcon className="size-7" />
            </span>
            <h3 className="mt-4.5 mb-0.5 text-[32px] leading-tight font-extrabold tracking-[-0.04em] sm:text-[38px]">
              {text.talk.title}
            </h3>
            <p className="mb-3 font-extrabold text-orange-ink">{text.talk.lead}</p>
            <p className="m-0 max-w-135 text-sm leading-[1.65] text-muted">{text.talk.body}</p>

            <ul aria-hidden className="mt-5.5 mb-3.75 flex gap-1.25 overflow-auto sm:mt-7">
              {text.talk.tabs.map((tab, index) => (
                <li
                  key={tab}
                  className={
                    index === 0
                      ? "rounded-[9px] bg-brand px-2.75 py-2 text-[11px] font-extrabold whitespace-nowrap text-white"
                      : "rounded-[9px] bg-surface-alt px-2.75 py-2 text-[11px] font-extrabold whitespace-nowrap text-muted"
                  }
                >
                  {tab}
                </li>
              ))}
            </ul>
            <div className="flex min-h-32.25 flex-col justify-center gap-1.5 rounded-2xl border border-line bg-surface-alt p-3.25 sm:p-4.25">
              <span className="w-fit rounded-sm border border-orange/50 bg-surface px-2.5 py-1 text-[11px] font-extrabold tracking-[0.08em] text-orange-ink uppercase">
                {text.talk.soon}
              </span>
              <p className="m-0 font-heading text-sm font-extrabold text-ink">{text.talk.soonTitle}</p>
              <p className="m-0 text-small text-muted">{text.talk.soonBody}</p>
            </div>
            <Link
              href="/doctor-talk"
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-small font-extrabold text-brand hover:underline"
            >
              {text.talk.link}
              <ButtonArrow />
            </Link>
          </article>

          <article
            id="quiz"
            className="reveal relative overflow-hidden rounded-[20px] bg-quiz p-5.5 text-ink shadow-gold sm:rounded-xl sm:p-7 lg:p-8.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-heading text-xs font-extrabold tracking-[0.14em] text-gold-ink">
                {text.quiz.number}
              </span>
              <span className="rounded-sm bg-ink px-2.5 py-1.75 text-[11px] font-extrabold text-white">
                {text.quiz.reward(quiz.reward)}
              </span>
            </div>
            <span
              aria-hidden
              className="mt-6 grid size-12.25 place-items-center rounded-[17px] bg-ink text-gold-light sm:mt-8 sm:size-14"
            >
              <QuizIcon className="size-7" />
            </span>
            <h3 className="mt-4.5 mb-0.5 text-[32px] leading-tight font-extrabold tracking-[-0.04em] sm:text-[38px]">
              {text.quiz.title}
            </h3>
            <p className="mb-3 font-extrabold text-gold-ink">
              {live.kind === "open"
                ? text.quiz.leadOpen(live.title)
                : live.kind === "next"
                  ? text.quiz.opensOn(formatDateTime(live.startsAt))
                  : text.quiz.leadNext}
            </p>
            <p className="m-0 max-w-135 text-sm leading-[1.65] text-gold-ink">{text.quiz.body}</p>

            <div className="mt-5.5 mb-5 rounded-[17px] border border-white/60 bg-white/50 p-3.75 sm:mt-7 sm:p-5">
              <div className="flex justify-between text-[11px] font-extrabold tracking-[0.08em] uppercase">
                <span>{text.quiz.questions(questions)}</span>
                <span>{text.quiz.minutes(quiz.minutes)}</span>
              </div>
              <div
                role="progressbar"
                aria-label={text.quiz.progressLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={bestPercent}
                className="mt-3 mb-4.5 h-1.75 overflow-hidden rounded-[10px] bg-ink/12"
              >
                <span className="block h-full rounded-[10px] bg-brand" style={{ width: `${bestPercent}%` }} />
              </div>
              <dl className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: text.quiz.best,
                    value: quiz.you ? `${quiz.you.score}/${quiz.you.maxScore}` : text.quiz.none,
                  },
                  { label: text.quiz.rank, value: quiz.rank ? `#${quiz.rank}` : text.quiz.none },
                  { label: text.quiz.rewardLabel, value: String(quiz.reward) },
                ].map((item, index) => (
                  <div
                    key={item.label}
                    className={
                      index < 2
                        ? "flex flex-col border-r border-ink/12 pr-2"
                        : "flex flex-col pr-2"
                    }
                  >
                    <dt className="text-[11px]">{item.label}</dt>
                    <dd className="m-0 mt-0.75 font-heading text-[19px] font-extrabold">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <Link
              href={live.kind === "open" ? "/quiz" : "/quiz/leaderboard"}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-button bg-ink px-5 text-sm font-extrabold text-white transition hover:bg-brand-dark motion-safe:hover:-translate-y-0.5"
            >
              {live.kind === "open" ? text.quiz.start : text.quiz.leaderboard}
              <ButtonArrow />
            </Link>
            <p className="mt-2.5 mb-0 text-center text-[11px] text-gold-ink">{text.quiz.once}</p>
          </article>
        </div>
      </div>
    </section>
  );
}
