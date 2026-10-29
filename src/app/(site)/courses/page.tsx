import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { CoursesBrowser } from "@/components/site/courses/courses-browser";
import { LiveList } from "@/components/site/courses/live-list";
import {
  PageHero,
  PortalSectionTitle,
  PortalShell,
  pillClasses,
} from "@/components/site/portal/page-hero";
import { buttonClasses } from "@/components/ui/button";
import { courses as coursesCopy } from "@/content/courses";
import { portalPages } from "@/content/portal-pages";
import { doctorCoursesPath } from "@/lib/courses";
import { getSetting } from "@/server/content/settings";
import { getLearningContent } from "@/server/content/pages";

const copy = portalPages.courses;

export const metadata: Metadata = { title: copy.metaTitle };

/**
 * Courses & Saatvik Live (U.12): course cards from CourseTeaser and upcoming
 * sessions from LiveSession, both edited in the admin. Courses with a price
 * are bought from their own page (B1); approved doctors add their own (B2).
 */
export default async function CoursesPage() {
  const [{ courses, live }, phone] = await Promise.all([
    getLearningContent(),
    getSetting("contact.phone"),
  ]);

  return (
    <>
      <PageHero copy={copy.hero} />
      <PortalShell>
        <nav
          aria-label={copy.tabsLabel}
          className="scrollbar-none mb-5 flex gap-1.5 overflow-x-auto"
        >
          <a
            href="#courses"
            aria-current="true"
            className={pillClasses(true)}
          >
            {copy.tabs.courses}
          </a>
          <a href="#live" className={pillClasses(false)}>
            {copy.tabs.live}
          </a>
          <Link href="/ebooks" className={pillClasses(false)}>
            {copy.tabs.ebooks}
          </Link>
        </nav>

        <section id="courses" aria-label={copy.tabs.courses} className="scroll-mt-40">
          <CoursesBrowser courses={courses} phone={phone} />
          <aside
            aria-labelledby="teach-title"
            className="mt-6 flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex gap-3">
              <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
                <GraduationCap className="size-5" />
              </span>
              <div>
                <h2 id="teach-title" className="font-heading text-base font-extrabold text-ink">
                  {coursesCopy.teachCallout.title}
                </h2>
                <p className="text-small text-muted">{coursesCopy.teachCallout.text}</p>
              </div>
            </div>
            <Link
              href={doctorCoursesPath}
              className={buttonClasses({ variant: "secondary", className: "shrink-0 max-sm:w-full" })}
            >
              {coursesCopy.teachCallout.action}
            </Link>
          </aside>
        </section>

        <section
          id="live"
          aria-labelledby="live-title"
          className="mt-11 scroll-mt-40"
        >
          <PortalSectionTitle
            id="live-title"
            title={copy.liveTitle}
            text={copy.liveText}
          />
          <LiveList sessions={live} />
        </section>
      </PortalShell>
    </>
  );
}
