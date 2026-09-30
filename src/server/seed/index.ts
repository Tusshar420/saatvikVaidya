import { settingDefaults, type SettingKey } from "@/content/settings";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  heroPanelSchemas,
  heroProofSchema,
  linkTargetSchema,
  sectionContentSchemas,
  sitePathSchema,
} from "@/server/content/home-schema";
import {
  brandSeed,
  categorySeed,
  courseTeaserSeed,
  feedbackSeed,
  heroSlideSeed,
  homeSectionSeed,
  liveSessionSeed,
  offerSeed,
  quickActionSeed,
  reelSeed,
  statItemSeed,
  whyStepSeed,
} from "./home-content";
import { userTypeSeed } from "./user-types";

/**
 * Seeds user types, default settings and homepage content. Safe to run any
 * number of times:
 * - User types and content are upserted by `key`. Re-running restores the
 *   seeded copy, but keeps placement and visibility (`sortOrder`, `active`,
 *   `enabled`, `featured`), which only apply when a row is first created.
 * - Reels, brands and courses are edited in the admin panel, so they are only
 *   created when missing; their copy is never overwritten.
 * - Settings are only created when missing, so edited values are never
 *   overwritten. Each creation also writes a SettingHistory row.
 * - Rows the seed doesn't know about are left alone.
 *
 * Takes the client as an argument because it runs both from `pnpm db:seed`
 * (tsx, outside Next) and from tests.
 */
export async function seedDatabase(db: PrismaClient): Promise<SeedSummary> {
  validateSeed();

  return db.$transaction(
    async (tx) => {
      await syncByKey(userTypeSeed, (args) => tx.userType.upsert(args));
      const settingsCreated = await createMissingSettings(tx);
      await syncByKey(homeSectionSeed, (args) => tx.homeSection.upsert(args));
      await syncByKey(heroSlideSeed, (args) => tx.heroSlide.upsert(args));
      await syncByKey(statItemSeed, (args) => tx.statItem.upsert(args));
      await createMissing(reelSeed, (args) => tx.reel.upsert(args));
      await syncByKey(offerSeed, (args) => tx.offer.upsert(args));
      await syncByKey(quickActionSeed, (args) => tx.quickAction.upsert(args));
      await syncByKey(categorySeed, (args) => tx.category.upsert(args));
      await createMissing(brandSeed, (args) => tx.brand.upsert(args));
      await createMissing(courseTeaserSeed, (args) => tx.courseTeaser.upsert(args));
      await syncByKey(liveSessionSeed, (args) => tx.liveSession.upsert(args));
      await syncByKey(feedbackSeed, (args) => tx.feedback.upsert(args));
      await syncByKey(whyStepSeed, (args) => tx.whyStep.upsert(args));

      return {
        userTypes: userTypeSeed.length,
        settingsCreated,
        homeSections: homeSectionSeed.length,
        contentRows: [
          heroSlideSeed,
          statItemSeed,
          reelSeed,
          offerSeed,
          quickActionSeed,
          categorySeed,
          brandSeed,
          courseTeaserSeed,
          liveSessionSeed,
          feedbackSeed,
          whyStepSeed,
        ].reduce((sum, rows) => sum + rows.length, 0),
      };
    },
    { timeout: 30_000 },
  );
}

export type SeedSummary = {
  userTypes: number;
  settingsCreated: SettingKey[];
  homeSections: number;
  contentRows: number;
};

/** Written only when a row is created; see seedDatabase(). */
const placementFields = ["sortOrder", "active", "enabled", "featured"] as const;
type PlacementField = (typeof placementFields)[number];

async function syncByKey<T extends { key: string }>(
  rows: readonly T[],
  upsert: (args: {
    where: { key: string };
    create: T;
    update: Omit<T, "key" | PlacementField>;
  }) => Promise<unknown>,
): Promise<void> {
  for (const row of rows) {
    const update = Object.fromEntries(
      Object.entries(row).filter(
        ([field]) =>
          field !== "key" &&
          !(placementFields as readonly string[]).includes(field),
      ),
      // Safe: the filter removes exactly the omitted fields.
    ) as Omit<T, "key" | PlacementField>;
    await upsert({ where: { key: row.key }, create: row, update });
  }
}

/** Creates rows whose key is missing; existing rows are left untouched. */
async function createMissing<T extends { key: string }>(
  rows: readonly T[],
  upsert: (args: {
    where: { key: string };
    create: T;
    update: Record<string, never>;
  }) => Promise<unknown>,
): Promise<void> {
  for (const row of rows) {
    await upsert({ where: { key: row.key }, create: row, update: {} });
  }
}

async function createMissingSettings(
  tx: Prisma.TransactionClient,
): Promise<SettingKey[]> {
  const keys = Object.keys(settingDefaults) as SettingKey[];
  const existing = await tx.setting.findMany({
    where: { key: { in: keys } },
    select: { key: true },
  });
  const present = new Set(existing.map((row) => row.key));
  const created: SettingKey[] = [];

  for (const key of keys) {
    if (present.has(key)) continue;
    const value = settingDefaults[key];
    await tx.setting.create({
      data: { key, value, history: { create: { value } } },
    });
    created.push(key);
  }
  return created;
}

/** Fails loudly before writing if any seeded content wouldn't be shown. */
function validateSeed(): void {
  const problems: string[] = [];
  const check = (where: string, result: { success: boolean }) => {
    if (!result.success) problems.push(where);
  };
  const href = (where: string, value: string | null | undefined) => {
    if (value != null) check(where, linkTargetSchema.safeParse(value));
  };

  for (const section of homeSectionSeed) {
    href(`HomeSection ${section.key} linkHref`, section.linkHref);
    const schema =
      sectionContentSchemas[section.key as keyof typeof sectionContentSchemas];
    if (schema) {
      check(
        `HomeSection ${section.key} content`,
        schema.safeParse(section.content),
      );
    } else if (section.content !== undefined) {
      problems.push(`HomeSection ${section.key} has content but no schema`);
    }
  }

  for (const slide of heroSlideSeed) {
    href(`HeroSlide ${slide.key} primaryHref`, slide.primaryHref);
    href(`HeroSlide ${slide.key} secondaryHref`, slide.secondaryHref);
    check(
      `HeroSlide ${slide.key} panel`,
      heroPanelSchemas[slide.panelKind].safeParse(slide.panel),
    );
    if (slide.proof != null) {
      check(
        `HeroSlide ${slide.key} proof`,
        heroProofSchema.safeParse(slide.proof),
      );
    }
  }

  for (const [model, rows] of [
    ["Reel", reelSeed],
    ["Offer", offerSeed],
    ["Brand", brandSeed],
    ["CourseTeaser", courseTeaserSeed],
    ["LiveSession", liveSessionSeed],
    ["Feedback", feedbackSeed],
  ] as const) {
    for (const row of rows) href(`${model} ${row.key} linkHref`, row.linkHref);
  }
  for (const row of quickActionSeed) {
    href(`QuickAction ${row.key} href`, row.href);
  }

  const media = (where: string, value: string | null | undefined) => {
    if (value != null) check(where, sitePathSchema.safeParse(value));
  };
  for (const row of reelSeed) {
    media(`Reel ${row.key} mediaSrc`, row.mediaSrc);
    media(`Reel ${row.key} posterSrc`, row.posterSrc);
  }
  for (const row of feedbackSeed) {
    media(`Feedback ${row.key} imageSrc`, row.imageSrc);
  }

  if (problems.length > 0) {
    throw new Error(`Invalid seed data:\n- ${problems.join("\n- ")}`);
  }
}
