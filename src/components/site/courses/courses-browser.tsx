"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap, Phone } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalContent, ModalTrigger } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { telHref } from "@/lib/phone";
import { portalPages } from "@/content/portal-pages";
import type { CourseCardItem } from "@/server/content/pages";
import { pillClasses, portalCardClasses } from "../portal/page-hero";

const copy = portalPages.courses;

/** Course cover colours, in turn (`.course-card:nth-child(n) .course-cover`). */
const covers = ["bg-pack-green", "bg-pack-saffron", "bg-pack-blue"] as const;

function sentenceCase(text: string): string {
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Course cards with level chips built from the courses' own tags. "View
 * course" opens the details; enrolment shows a coming-soon note until P3.1.
 */
export function CoursesBrowser({
  courses,
  phone,
}: {
  courses: CourseCardItem[];
  phone: string;
}) {
  const topics = useMemo(
    () => [...new Set(courses.map((c) => c.tag))],
    [courses],
  );
  const [topic, setTopic] = useState<string | null>(null);
  const shown = topic ? courses.filter((c) => c.tag === topic) : courses;

  if (courses.length === 0) {
    return (
      <EmptyState
        icon={<GraduationCap aria-hidden />}
        title={copy.emptyCoursesTitle}
        description={copy.emptyCoursesText}
      />
    );
  }

  return (
    <>
      {topics.length > 1 && (
        <div
          role="group"
          aria-label={copy.topicsLabel}
          className="scrollbar-none -mr-3.25 mb-5.5 flex gap-1.75 overflow-x-auto pr-3.25 sm:mr-0 sm:pr-0"
        >
          <button
            type="button"
            aria-pressed={topic === null}
            onClick={() => setTopic(null)}
            className={pillClasses(topic === null, "rounded-[11px]")}
          >
            {copy.allTopics}
          </button>
          {topics.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={topic === t}
              onClick={() => setTopic(t)}
              className={pillClasses(
                topic === t,
                cn("rounded-[11px]", topic !== t && "text-ink"),
              )}
            >
              {sentenceCase(t)}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-muted">{copy.emptyTopicText}</p>
      ) : (
        <ul className="scrollbar-none -mr-3.25 flex snap-x snap-mandatory gap-3.75 overflow-x-auto pr-3.25 pb-1 sm:mr-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pr-0 lg:grid-cols-3">
          {shown.map((course, i) => (
            <li
              key={course.key}
              className="w-[275px] shrink-0 snap-start sm:w-auto"
            >
              <CourseCard
                course={course}
                cover={covers[i % covers.length]}
                phone={phone}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CourseCard({
  course,
  cover,
  phone,
}: {
  course: CourseCardItem;
  cover: (typeof covers)[number];
  phone: string;
}) {
  const metas = [
    course.duration
      ? { label: copy.durationLabel, value: course.duration }
      : course.instructor
        ? { label: copy.instructorLabel, value: course.instructor }
        : null,
    course.meta,
  ].filter((m): m is { label: string; value: string } => m !== null);

  return (
    <article
      className={cn(
        portalCardClasses,
        "flex h-full flex-col overflow-hidden transition hover:shadow-raised motion-safe:hover:-translate-y-0.75",
      )}
    >
      <div
        className={cn(
          "relative flex h-47.5 flex-col justify-between overflow-hidden p-5 text-white",
          cover,
        )}
      >
        <span
          aria-hidden
          className="absolute top-6.25 -right-17.5 size-45 rounded-full border-[28px] border-white/8"
        />
        <span className="relative text-[11px] font-extrabold tracking-[0.1em] text-gold-light uppercase">
          {course.meta.value}
        </span>
        <span
          aria-hidden
          className="relative max-w-[240px] font-heading text-[22px] leading-[1.07] font-extrabold tracking-[-0.02em]"
        >
          {course.title}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4.5">
        <p className="text-[11px] font-extrabold tracking-[0.1em] text-orange-ink uppercase">
          {course.tag}
        </p>
        <h3 className="mt-1.5 mb-1.5 text-h4 text-ink">{course.title}</h3>
        <p className="text-small text-muted">{course.body}</p>
        <dl className="my-4 grid grid-cols-2 gap-2">
          {metas.map((m) => (
            <div
              key={m.label}
              className="flex flex-col border-l-2 border-orange pl-2"
            >
              <dt className="text-[11px] text-muted">{m.label}</dt>
              <dd className="mt-0.5 text-small font-bold text-ink">
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto">
          {course.link.href ? (
            <Link
              href={course.link.href}
              className="flex min-h-11 w-full items-center justify-center rounded-[9px] bg-brand text-small font-extrabold text-white transition-colors hover:bg-brand-mid"
            >
              {course.link.label || copy.viewCourse}
            </Link>
          ) : (
            <Modal>
              <ModalTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-[9px] bg-brand text-small font-extrabold text-white transition-colors hover:bg-brand-mid"
                >
                  {copy.viewCourse}
                </button>
              </ModalTrigger>
              <ModalContent
                eyebrow={course.tag}
                title={course.title}
                description={course.body}
                icon={<GraduationCap aria-hidden />}
              >
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    course.meta,
                    course.duration
                      ? { label: copy.durationLabel, value: course.duration }
                      : null,
                    course.instructor
                      ? {
                          label: copy.instructorLabel,
                          value: course.instructor,
                        }
                      : null,
                  ]
                    .filter(
                      (m): m is { label: string; value: string } => m !== null,
                    )
                    .map((m) => (
                      <div
                        key={m.label}
                        className="flex flex-col border-l-2 border-orange pl-2.5"
                      >
                        <dt className="text-xs text-muted">{m.label}</dt>
                        <dd className="text-sm font-bold text-ink">
                          {m.value}
                        </dd>
                      </div>
                    ))}
                </dl>
                <div className="mt-5 rounded-md bg-gold-soft p-4">
                  <Badge variant="soon">{portalPages.comingNext}</Badge>
                  <p className="mt-2 font-heading font-extrabold text-ink">
                    {copy.enrolSoonTitle}
                  </p>
                  <p className="mt-1 text-sm text-gold-ink">
                    {copy.enrolSoonText}
                  </p>
                </div>
                <a
                  href={telHref(phone)}
                  className={buttonClasses({ className: "mt-5 w-full" })}
                >
                  <Phone aria-hidden className="size-4" />
                  {copy.call(phone)}
                </a>
              </ModalContent>
            </Modal>
          )}
        </div>
      </div>
    </article>
  );
}
