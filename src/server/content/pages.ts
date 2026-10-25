import "server-only";
import { courseForSale, courseHref, listedCourseWhere } from "@/lib/courses";
import { pageForSectionLink } from "@/lib/section-links";
import { db } from "@/server/db";
import { cachedRead, contentTags } from "./cache";
import { linkTargetSchema, sitePathSchema } from "./home-schema";
import type { ContentLink, StatItemView, WhyStepItem } from "./home";

/**
 * Content for the v2 inner pages (Courses, Real Feedback, Why Saatvik). It is
 * the same admin-edited rows the homepage sections use, read directly so the
 * pages work even when the matching homepage section is switched off. Links
 * and media paths are validated the same way as on the homepage.
 */

export type CourseCardItem = {
  key: string;
  tag: string;
  title: string;
  body: string;
  meta: { label: string; value: string };
  instructor: string | null;
  duration: string | null;
  link: ContentLink;
  /** Sold online (B1): its price including GST; the card then opens the course page. */
  pricePaise: number | null;
  /** The course page, for courses sold online. */
  href: string | null;
};

export type LiveCardItem = {
  key: string;
  tag: string;
  title: string;
  body: string;
  meta: { label: string; value: string };
  link: ContentLink;
};

export type FeedbackCardItem = {
  key: string;
  imageSrc: string;
  imageAlt: string;
  badge: string;
  quote: string;
  caption: string;
  linkLabel: string;
};

const activeInOrder = {
  where: { active: true },
  orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
};

function link(label: string, value: string | null, where: string): ContentLink {
  if (value === null) return { label, href: null };
  const parsed = linkTargetSchema.safeParse(value);
  if (parsed.success) return { label, href: pageForSectionLink(parsed.data) };
  console.error(`portal pages: invalid link in ${where}; shown as coming soon.`);
  return { label, href: null };
}

async function readLearning(): Promise<{
  courses: CourseCardItem[];
  live: LiveCardItem[];
}> {
  const [courses, live] = await Promise.all([
    // Doctors' courses are listed only once staff publish them (B2).
    db.courseTeaser.findMany({ ...activeInOrder, where: listedCourseWhere }),
    db.liveSession.findMany(activeInOrder),
  ]);
  return {
    courses: courses.map((c) => ({
      key: c.key,
      tag: c.tag,
      title: c.title,
      body: c.body,
      meta: { label: c.metaLabel, value: c.metaValue },
      instructor: c.instructor,
      duration: c.duration,
      link: link(c.linkLabel, c.linkHref, `CourseTeaser ${c.key}`),
      pricePaise: courseForSale(c) ? c.pricePaise : null,
      href: courseForSale(c) ? courseHref(c.key) : null,
    })),
    live: live.map((s) => ({
      key: s.key,
      tag: s.tag,
      title: s.title,
      body: s.body,
      meta: { label: s.metaLabel, value: s.metaValue },
      link: link(s.linkLabel, s.linkHref, `LiveSession ${s.key}`),
    })),
  };
}

async function readFeedback(): Promise<FeedbackCardItem[]> {
  const rows = await db.feedback.findMany({
    where: { active: true },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
  return rows.flatMap((f) => {
    if (!sitePathSchema.safeParse(f.imageSrc).success) {
      console.error(`portal pages: invalid image in Feedback ${f.key}; left out.`);
      return [];
    }
    return [
      {
        key: f.key,
        imageSrc: f.imageSrc,
        imageAlt: f.imageAlt,
        badge: f.badge,
        quote: f.quote,
        caption: f.caption,
        linkLabel: f.linkLabel,
      },
    ];
  });
}

async function readWhy(): Promise<{
  steps: WhyStepItem[];
  stats: StatItemView[];
}> {
  const [steps, stats] = await Promise.all([
    db.whyStep.findMany(activeInOrder),
    db.statItem.findMany(activeInOrder),
  ]);
  return {
    steps: steps.map((s) => ({ key: s.key, title: s.title, body: s.body })),
    stats: stats.map((s) => ({ key: s.key, value: s.value, label: s.label })),
  };
}

export const getLearningContent = cachedRead(
  readLearning,
  "pages:learning",
  contentTags.home,
);
export const getFeedbackContent = cachedRead(
  readFeedback,
  "pages:feedback",
  contentTags.home,
);
export const getWhyContent = cachedRead(readWhy, "pages:why", contentTags.home);
