import type { Metadata } from "next";
import Link from "next/link";
import { CoursesBrowser } from "@/components/site/courses/courses-browser";
import { LiveList } from "@/components/site/courses/live-list";
import {
  PageHero,
  PortalSectionTitle,
  PortalShell,
  pillClasses,
} from "@/components/site/portal/page-hero";
import { portalPages } from "@/content/portal-pages";
import { getSetting } from "@/server/content/settings";
import { getLearningContent } from "@/server/content/pages";

const copy = portalPages.courses;

export const metadata: Metadata = { title: copy.metaTitle };

/**
 * Courses & Saatvik Live (U.12): course cards from CourseTeaser and upcoming
 * sessions from LiveSession, both edited in the admin. No purchase flow yet.
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
