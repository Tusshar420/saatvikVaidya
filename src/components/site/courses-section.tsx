import Link from "next/link";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { home as copy } from "@/content/home";
import type { LearningItem, SectionHeading as Heading } from "@/server/content/home";
import { HomeHead, homeIcons } from "./home-parts";

const text = copy.courses;

const pathOr = (href: string | null | undefined, fallback: string) =>
  href?.startsWith("/") ? href : fallback;

/** v2 Clinical learning (`.learning-section`): a course card and a Saatvik Live card. */
export function CoursesSection({
  heading,
  courses,
  liveSessions,
}: {
  heading: Heading;
  courses: LearningItem[];
  liveSessions: LearningItem[];
}) {
  const course = courses[0];
  const live = liveSessions[0];
  const Leaf = homeIcons.launch;

  return (
    <section id="courses" aria-labelledby="courses-title" className="section-y bg-cream">
      <div className="shell">
        <HomeHead
          eyebrow={heading.eyebrow}
          title={<span id="courses-title">{heading.title}</span>}
          emphasis={heading.titleEmphasis}
          description={heading.description}
        />
        <div className="grid gap-5 md:grid-cols-[1.3fr_.7fr]">
          {course && (
            <article className="reveal grid overflow-hidden rounded-xl border border-line bg-surface shadow-raised sm:grid-cols-[.8fr_1.2fr]">
              <div className="relative flex min-h-52.5 flex-col justify-between overflow-hidden bg-forest p-6 text-white sm:min-h-85">
                <span
                  aria-hidden
                  className="absolute top-6.25 -right-27.5 size-70 rounded-full border-[45px] border-white/7"
                />
                <span className="relative font-heading text-[11px] font-extrabold tracking-[0.12em] uppercase">
                  {text.upcoming}
                </span>
                <span
                  aria-hidden
                  className="relative grid size-19.5 place-items-center self-center rounded-full border border-white/24 bg-white/8 sm:size-23.5"
                >
                  <Leaf className="size-11.5 text-gold-light" />
                </span>
                <span className="relative font-heading text-[11px] font-extrabold tracking-[0.12em] uppercase">
                  {text.online}
                </span>
              </div>
              <div className="flex flex-col justify-center p-6.25 sm:p-8.5">
                <span className="font-heading text-[11px] font-extrabold tracking-[0.12em] text-orange-ink uppercase">
                  {course.tag}
                </span>
                <h3 className="mt-2.25 mb-3 text-2xl leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-[28px]">
                  {course.title}
                </h3>
                <p className="m-0 text-sm leading-[1.6] text-muted">{course.body}</p>
                <dl className="my-6.25 grid grid-cols-2 gap-3">
                  <div className="flex flex-col border-l-2 border-orange pl-2.75">
                    <dt className="order-last mt-0.75 text-[11px] text-muted">{course.meta.label}</dt>
                    <dd className="m-0 text-xs font-bold">{course.meta.value}</dd>
                  </div>
                </dl>
                <Link
                  href={pathOr(course.link.href, "/courses")}
                  className={buttonClasses({
                    className: "self-start bg-brand shadow-none hover:bg-brand-mid max-sm:w-full",
                  })}
                >
                  {text.view}
                </Link>
              </div>
            </article>
          )}

          {live && (
            <article className="reveal relative min-h-77.5 overflow-hidden rounded-xl bg-brand p-6.25 text-white sm:min-h-82.5 md:p-8">
              <span
                aria-hidden
                className="absolute -right-27.5 -bottom-30 size-65 rounded-full bg-white/6"
              />
              <div className="relative flex items-center justify-between">
                <span className="flex items-center font-heading text-[11px] font-extrabold tracking-[0.12em] text-gold-light uppercase">
                  <span aria-hidden className="mr-1.25 inline-block size-1.75 rounded-full bg-live-dot ring-5 ring-live-dot/12" />
                  {text.live}
                </span>
                <small className="text-[11px] text-forest-ink">{text.expert}</small>
              </div>
              <h3 className="relative mt-10.5 mb-3 text-[26px] leading-[1.1] font-extrabold tracking-[-0.035em] sm:mt-12.5 sm:text-[29px]">
                {live.title}
              </h3>
              <p className="relative m-0 text-sm leading-[1.6] text-forest-ink">{live.body}</p>
              <div className="relative my-7.5 flex items-center gap-3">
                <span aria-hidden className="grid size-8.5 place-items-center rounded-full border-2 border-brand bg-gold text-gold-ink">
                  <Leaf className="size-4" />
                </span>
                <span className="flex flex-col">
                  <b className="text-xs">{live.meta.value}</b>
                  <small className="mt-0.75 text-[11px] text-forest-ink">{live.meta.label}</small>
                </span>
              </div>
              <Link
                href={pathOr(live.link.href, "/courses")}
                className="relative inline-flex min-h-11 items-center gap-2 text-small font-extrabold text-white hover:underline"
              >
                {text.schedule}
                <ButtonArrow />
              </Link>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
