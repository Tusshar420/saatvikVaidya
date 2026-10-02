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
import {
  SAMPLE_GST_RATE,
  SAMPLE_HSN_CODE,
  productSeed,
  type ProductSeed,
} from "./catalogue";
import { userTypeSeed } from "./user-types";

/**
 * Seeds user types, default settings and homepage content. Safe to run any
 * number of times:
 * - User types are upserted by `key`. Re-running restores the seeded copy,
 *   but keeps placement and visibility (`sortOrder`, `active`, `enabled`,
 *   `featured`), which only apply when a row is first created.
 * - Homepage content (sections, hero slides, stats, reels, offers, quick
 *   actions, categories, brands, courses, live sessions, feedback and
 *   why-steps) is edited in the admin panel (/admin/content), so it is only
 *   created when its key is missing; an existing row is never overwritten.
 * - Sample products (./catalogue.ts) are only created when their slug is
 *   missing, so catalogue edits are kept.
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
      await createMissing(homeSectionSeed, (args) => tx.homeSection.upsert(args));
      await createMissing(heroSlideSeed, (args) => tx.heroSlide.upsert(args));
      await createMissing(statItemSeed, (args) => tx.statItem.upsert(args));
      await createMissing(reelSeed, (args) => tx.reel.upsert(args));
      await createMissing(offerSeed, (args) => tx.offer.upsert(args));
      await createMissing(quickActionSeed, (args) => tx.quickAction.upsert(args));
      await createMissing(categorySeed, (args) => tx.category.upsert(args));
      await createMissing(brandSeed, (args) => tx.brand.upsert(args));
      await createMissing(courseTeaserSeed, (args) => tx.courseTeaser.upsert(args));
      await createMissing(liveSessionSeed, (args) => tx.liveSession.upsert(args));
      await createMissing(feedbackSeed, (args) => tx.feedback.upsert(args));
      await createMissing(whyStepSeed, (args) => tx.whyStep.upsert(args));
      const productsCreated = await createMissingProducts(tx);
      await addBrandSamples(tx);

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
        productsCreated,
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
  /** Sample products created this run (existing slugs are left alone). */
  productsCreated: number;
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

/**
 * Creates the sample products whose slug is missing. A product whose form
 * no longer exists is skipped; a missing brand or practice area is left off.
 */
async function createMissingProducts(
  tx: Prisma.TransactionClient,
): Promise<number> {
  const existing = new Set(
    (
      await tx.product.findMany({
        where: { slug: { in: productSeed.map((p) => p.slug) } },
        select: { slug: true },
      })
    ).map((p) => p.slug),
  );
  const [brands, categories] = await Promise.all([
    tx.brand.findMany({ select: { id: true, key: true } }),
    tx.category.findMany({ select: { id: true, key: true, kind: true } }),
  ]);
  const brandId = new Map(brands.map((b) => [b.key, b.id]));
  const formId = new Map(
    categories.filter((c) => c.kind === "FORM").map((c) => [c.key, c.id]),
  );
  const areaId = new Map(
    categories
      .filter((c) => c.kind === "PRACTICE_AREA")
      .map((c) => [c.key, c.id]),
  );

  let created = 0;
  for (const product of productSeed) {
    const { brandKey, formKey, practiceAreaKeys, bulkTiers, brand, ...fields } = product;
    const form = formId.get(formKey);
    if (existing.has(product.slug) || form === undefined) continue;
    await tx.product.create({
      data: {
        ...fields,
        ...(brand && brandFields(brand)),
        isSample: true,
        gstRate: SAMPLE_GST_RATE,
        hsnCode: SAMPLE_HSN_CODE,
        brandId: brandId.get(brandKey) ?? null,
        formId: form,
        practiceAreas: {
          connect: practiceAreaKeys.flatMap((key) => {
            const id = areaId.get(key);
            return id === undefined ? [] : [{ id }];
          }),
        },
        bulkTiers: { create: bulkTiers },
      },
    });
    created += 1;
  }
  return created;
}

function brandFields(brand: NonNullable<ProductSeed["brand"]>) {
  return {
    brandEligible: true,
    brandMinQty: brand.minQty,
    brandUnitPricePaise: brand.unitPricePaise,
    brandUnitLabel: brand.unitLabel,
  };
}

/**
 * Launch Your Brand sample values (P2.1) for sample products made before
 * they existed. Only products still marked sample whose brand minimum was
 * never set are changed, so the admin's (or the CSV import's) values stay.
 */
async function addBrandSamples(tx: Prisma.TransactionClient): Promise<void> {
  for (const product of productSeed) {
    if (!product.brand) continue;
    await tx.product.updateMany({
      where: { slug: product.slug, isSample: true, brandMinQty: null },
      data: brandFields(product.brand),
    });
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
