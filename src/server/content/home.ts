import "server-only";
import type {
  HeroPanelKind,
  ReelMediaKind,
  ReelType,
  Tone,
} from "@/generated/prisma/enums";
import type { HomeSection as HomeSectionRow } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { cachedRead, contentTags } from "./cache";
import {
  heroPanelSchemas,
  heroProofSchema,
  isHomeSectionKey,
  linkTargetSchema,
  sectionContentSchemas,
  sitePathSchema,
  type HeroPanel,
  type HeroProof,
  type HomeSectionKey,
  type LinkTarget,
  type SectionContent,
  type SectionContentKey,
} from "./home-schema";

export type { HeroPanel };

// ─── Types returned to the homepage ─────────────────────────────────────────

/** `href` null means the destination isn't built yet: show "coming soon". */
export type ContentLink = { label: string; href: LinkTarget | null };

export type SectionHeading = {
  eyebrow: string | null;
  title: string | null;
  titleEmphasis: string | null;
  description: string | null;
  link: ContentLink | null;
};

export type HeroSlideItem = {
  key: string;
  eyebrow: string;
  title: string;
  titleEmphasis: string | null;
  body: string;
  primary: ContentLink;
  secondary: ContentLink | null;
  proof: HeroProof | null;
  panel: HeroPanel;
};

export type StatItemView = { key: string; value: string; label: string };

export type ReelItem = {
  key: string;
  type: ReelType;
  mediaKind: ReelMediaKind;
  mediaSrc: string | null;
  posterSrc: string | null;
  mediaLabel: string | null;
  badge: string | null;
  badgeTone: Tone | null;
  metaLabel: string | null;
  valueLabel: string | null;
  poster: { kicker: string | null; text: string; byline: string | null } | null;
  title: string;
  link: ContentLink;
};

export type OfferItem = {
  key: string;
  tone: Tone;
  iconText: string;
  eyebrow: string;
  title: string;
  body: string;
  link: ContentLink;
};

export type QuickActionItem = {
  key: string;
  tone: Tone;
  iconText: string;
  title: string;
  description: string;
  href: LinkTarget | null;
};

export type CategoryItem = { key: string; name: string; glyph: string | null };

export type BrandItem = {
  key: string;
  featured: boolean;
  name: string;
  monogram: string;
  tone: Tone;
  eyebrow: string;
  description: string;
  link: ContentLink;
};

/** A course or Saatvik Live teaser card. */
export type LearningItem = {
  key: string;
  tag: string;
  title: string;
  body: string;
  meta: { label: string; value: string };
  link: ContentLink;
};

export type FeedbackItem = {
  key: string;
  featured: boolean;
  imageSrc: string;
  imageAlt: string;
  badge: string;
  quote: string;
  caption: string;
  link: ContentLink;
};

export type WhyStepItem = { key: string; title: string; body: string };

type Headed<K extends HomeSectionKey, T = object> = {
  key: K;
  heading: SectionHeading;
} & T;

/** One enabled homepage section. Switch on `key` to render it. */
export type HomeSection =
  | { key: "hero"; slides: HeroSlideItem[] }
  | { key: "trust"; stats: StatItemView[] }
  | Headed<
      "reels",
      { filters: SectionContent<"reels">["filters"]; reels: ReelItem[] }
    >
  | Headed<"offers", { offers: OfferItem[] }>
  | Headed<"quick-actions", { actions: QuickActionItem[] }>
  | Headed<
      "launch",
      SectionContent<"launch"> & {
        categories: { form: CategoryItem[]; practiceArea: CategoryItem[] };
      }
    >
  | Headed<"brands", { brands: BrandItem[] }>
  | Headed<"courses", { courses: LearningItem[]; liveSessions: LearningItem[] }>
  | Headed<"coins", SectionContent<"coins">>
  | Headed<"quiz", SectionContent<"quiz">>
  | Headed<"feedback", { feedback: FeedbackItem[] }>
  | Headed<"community", SectionContent<"community">>
  | Headed<"partner", SectionContent<"partner">>
  | Headed<"why", { steps: WhyStepItem[] }>;

export type HomeContent = { sections: HomeSection[] };

// ─── Reading ────────────────────────────────────────────────────────────────

const activeInOrder = {
  where: { active: true },
  orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
};

/**
 * The homepage straight from the database: enabled sections in `sortOrder`,
 * each with its active items in `sortOrder`.
 *
 * Everything stored as JSON or as a link is validated here. A section whose
 * content is invalid is left out, a hero slide with an invalid panel is left
 * out, and an unsafe link becomes null ("coming soon"); each is logged. Bad
 * data can hide a piece of the page but can't break it or inject a link.
 */
export async function readHomeContent(): Promise<HomeContent> {
  const rows = (
    await db.homeSection.findMany({
      where: { enabled: true },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    })
  ).filter((row) => isHomeSectionKey(row.key));

  const wanted = new Set(rows.map((row) => row.key));
  const when = <T>(keys: HomeSectionKey[], query: () => Promise<T[]>) =>
    keys.some((key) => wanted.has(key)) ? query() : Promise.resolve([]);

  const [
    heroSlides,
    stats,
    reels,
    offers,
    quickActions,
    categories,
    brands,
    courses,
    liveSessions,
    feedback,
    whySteps,
  ] = await Promise.all([
    when(["hero"], () => db.heroSlide.findMany(activeInOrder)),
    when(["trust"], () => db.statItem.findMany(activeInOrder)),
    when(["reels"], () => db.reel.findMany(activeInOrder)),
    when(["offers"], () => db.offer.findMany(activeInOrder)),
    when(["quick-actions"], () => db.quickAction.findMany(activeInOrder)),
    when(["launch"], () => db.category.findMany(activeInOrder)),
    when(["brands"], () => db.brand.findMany(activeInOrder)),
    when(["courses"], () => db.courseTeaser.findMany(activeInOrder)),
    when(["courses"], () => db.liveSession.findMany(activeInOrder)),
    when(["feedback"], () =>
      db.feedback.findMany({
        where: { active: true },
        orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      }),
    ),
    when(["why"], () => db.whyStep.findMany(activeInOrder)),
  ]);

  const learning = (
    row: (typeof courses)[number] | (typeof liveSessions)[number],
    model: string,
  ): LearningItem => ({
    key: row.key,
    tag: row.tag,
    title: row.title,
    body: row.body,
    meta: { label: row.metaLabel, value: row.metaValue },
    link: link(row.linkLabel, row.linkHref, `${model} ${row.key}`),
  });

  const sections: HomeSection[] = [];
  for (const row of rows) {
    const key = row.key as HomeSectionKey;
    const where = `HomeSection ${key}`;
    const heading = toHeading(row);

    switch (key) {
      case "hero":
        sections.push({
          key,
          slides: heroSlides.flatMap((slide) => {
            const panel = parsePanel(slide.panelKind, slide.panel);
            if (!panel) {
              logInvalid(`HeroSlide ${slide.key} panel`);
              return [];
            }
            const proof = slide.proof
              ? heroProofSchema.safeParse(slide.proof)
              : null;
            if (proof && !proof.success)
              logInvalid(`HeroSlide ${slide.key} proof`);
            return [
              {
                key: slide.key,
                eyebrow: slide.eyebrow,
                title: slide.title,
                titleEmphasis: slide.titleEmphasis,
                body: slide.body,
                primary: link(
                  slide.primaryLabel,
                  slide.primaryHref,
                  `HeroSlide ${slide.key}`,
                ),
                secondary: slide.secondaryLabel
                  ? link(
                      slide.secondaryLabel,
                      slide.secondaryHref,
                      `HeroSlide ${slide.key}`,
                    )
                  : null,
                proof: proof?.success ? proof.data : null,
                panel,
              },
            ];
          }),
        });
        break;

      case "trust":
        sections.push({
          key,
          stats: stats.map((s) => ({
            key: s.key,
            value: s.value,
            label: s.label,
          })),
        });
        break;

      case "reels": {
        const content = parseContent("reels", row);
        if (!content) break;
        sections.push({
          key,
          heading,
          filters: content.filters,
          reels: reels.map((r) => ({
            key: r.key,
            type: r.type,
            mediaKind: r.mediaKind,
            mediaSrc: mediaPath(r.mediaSrc, `Reel ${r.key}`),
            posterSrc: mediaPath(r.posterSrc, `Reel ${r.key}`),
            mediaLabel: r.mediaLabel,
            badge: r.badge,
            badgeTone: r.badgeTone,
            metaLabel: r.metaLabel,
            valueLabel: r.valueLabel,
            poster:
              r.mediaKind === "POSTER" && r.posterText
                ? {
                    kicker: r.posterKicker,
                    text: r.posterText,
                    byline: r.posterByline,
                  }
                : null,
            title: r.title,
            link: link(r.linkLabel, r.linkHref, `Reel ${r.key}`),
          })),
        });
        break;
      }

      case "offers":
        sections.push({
          key,
          heading,
          offers: offers.map((o) => ({
            key: o.key,
            tone: o.tone,
            iconText: o.iconText,
            eyebrow: o.eyebrow,
            title: o.title,
            body: o.body,
            link: link(o.linkLabel, o.linkHref, `Offer ${o.key}`),
          })),
        });
        break;

      case "quick-actions":
        sections.push({
          key,
          heading,
          actions: quickActions.map((a) => ({
            key: a.key,
            tone: a.tone,
            iconText: a.iconText,
            title: a.title,
            description: a.description,
            href: href(a.href, `QuickAction ${a.key}`),
          })),
        });
        break;

      case "launch": {
        const content = parseContent("launch", row);
        if (!content) break;
        const toCategory = (c: (typeof categories)[number]): CategoryItem => ({
          key: c.key,
          name: c.name,
          glyph: c.glyph,
        });
        sections.push({
          key,
          heading,
          ...content,
          categories: {
            form: categories.filter((c) => c.kind === "FORM").map(toCategory),
            practiceArea: categories
              .filter((c) => c.kind === "PRACTICE_AREA")
              .map(toCategory),
          },
        });
        break;
      }

      case "brands":
        sections.push({
          key,
          heading,
          brands: brands.map((b) => ({
            key: b.key,
            featured: b.featured,
            name: b.name,
            monogram: b.monogram,
            tone: b.tone,
            eyebrow: b.eyebrow,
            description: b.description,
            link: link(b.linkLabel, b.linkHref, `Brand ${b.key}`),
          })),
        });
        break;

      case "courses":
        sections.push({
          key,
          heading,
          courses: courses.map((c) => learning(c, "CourseTeaser")),
          liveSessions: liveSessions.map((s) => learning(s, "LiveSession")),
        });
        break;

      case "feedback":
        sections.push({
          key,
          heading,
          feedback: feedback.flatMap((f) => {
            const imageSrc = mediaPath(f.imageSrc, `Feedback ${f.key}`);
            if (!imageSrc) return [];
            return [
              {
                key: f.key,
                featured: f.featured,
                imageSrc,
                imageAlt: f.imageAlt,
                badge: f.badge,
                quote: f.quote,
                caption: f.caption,
                link: link(f.linkLabel, f.linkHref, `Feedback ${f.key}`),
              },
            ];
          }),
        });
        break;

      case "why":
        sections.push({
          key,
          heading,
          steps: whySteps.map((s) => ({
            key: s.key,
            title: s.title,
            body: s.body,
          })),
        });
        break;

      case "coins":
      case "quiz":
      case "community":
      case "partner": {
        const content = parseContent(key, row);
        if (!content) break;
        // Safe: `content` was parsed with this key's schema, so the pair
        // matches one member of the union; TypeScript can't correlate them.
        sections.push({ key, heading, ...content } as HomeSection);
        break;
      }

      default: {
        const unhandled: never = key;
        logInvalid(`${where} (no renderer for ${String(unhandled)})`);
      }
    }
  }

  return { sections };
}

const cachedHomeContent = cachedRead(
  readHomeContent,
  "home:content",
  contentTags.home,
);

/**
 * The homepage content (cached; see readHomeContent for the rules). Throws if
 * the database can't be reached: unlike settings, there's no sensible default
 * homepage to fall back to.
 */
export function getHomeContent(): Promise<HomeContent> {
  return cachedHomeContent();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function logInvalid(where: string): void {
  console.error(`getHomeContent: invalid ${where}; left out.`);
}

function href(value: string | null, where: string): LinkTarget | null {
  if (value === null) return null;
  const parsed = linkTargetSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  logInvalid(`link in ${where}`);
  return null;
}

function link(label: string, value: string | null, where: string): ContentLink {
  return { label, href: href(value, where) };
}

function mediaPath(value: string | null, where: string): string | null {
  if (value === null) return null;
  if (sitePathSchema.safeParse(value).success) return value;
  logInvalid(`media path in ${where}`);
  return null;
}

function toHeading(row: HomeSectionRow): SectionHeading {
  return {
    eyebrow: row.eyebrow,
    title: row.title,
    titleEmphasis: row.titleEmphasis,
    description: row.description,
    link: row.linkLabel
      ? link(row.linkLabel, row.linkHref, `HomeSection ${row.key}`)
      : null,
  };
}

function parseContent<K extends SectionContentKey>(
  key: K,
  row: HomeSectionRow,
): SectionContent<K> | null {
  const parsed = sectionContentSchemas[key].safeParse(row.content);
  // Safe: sectionContentSchemas[K] parses to SectionContent<K>, but TypeScript
  // can't follow the generic index.
  if (parsed.success) return parsed.data as SectionContent<K>;
  logInvalid(`HomeSection ${key} content`);
  return null;
}

function parsePanel(kind: HeroPanelKind, value: unknown): HeroPanel | null {
  const parsed = heroPanelSchemas[kind].safeParse(value);
  // Safe: the schema is picked by `kind`, so data + kind is that union member.
  return parsed.success ? ({ kind, ...parsed.data } as HeroPanel) : null;
}
