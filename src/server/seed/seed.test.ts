import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { settingDefaults } from "@/content/settings";
import { db } from "@/server/db";
import { homeSectionKeys } from "@/server/content/home-schema";
import { clearContentTables } from "../../../tests/setup/content-db";
import {
  brandSeed,
  courseTeaserSeed,
  feedbackSeed,
  offerSeed,
  reelSeed,
} from "./home-content";
import { seedDatabase } from ".";

const root = resolve(import.meta.dirname, "../../..");

/** Every seeded row, minus timestamps (which change on each upsert). */
async function snapshot() {
  const strip = <T extends object>(rows: T[]) =>
    rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).filter(
          ([field]) => !["createdAt", "updatedAt", "changedAt"].includes(field),
        ),
      ),
    );
  const byId = { orderBy: { id: "asc" as const } };
  return {
    userTypes: strip(await db.userType.findMany(byId)),
    settings: strip(await db.setting.findMany({ orderBy: { key: "asc" } })),
    settingHistory: strip(await db.settingHistory.findMany(byId)),
    homeSections: strip(
      await db.homeSection.findMany({ orderBy: { key: "asc" } }),
    ),
    heroSlides: strip(await db.heroSlide.findMany(byId)),
    statItems: strip(await db.statItem.findMany(byId)),
    reels: strip(await db.reel.findMany(byId)),
    offers: strip(await db.offer.findMany(byId)),
    quickActions: strip(await db.quickAction.findMany(byId)),
    categories: strip(await db.category.findMany(byId)),
    brands: strip(await db.brand.findMany(byId)),
    courseTeasers: strip(await db.courseTeaser.findMany(byId)),
    liveSessions: strip(await db.liveSession.findMany(byId)),
    feedback: strip(await db.feedback.findMany(byId)),
    whySteps: strip(await db.whyStep.findMany(byId)),
  };
}

/** Every string value stored anywhere in `value`, recursively. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(strings);
  }
  return [];
}

beforeEach(async () => {
  await clearContentTables(db);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("seedDatabase", () => {
  it("seeds the user types, settings and every homepage section", async () => {
    const summary = await seedDatabase(db);

    const userTypes = await db.userType.findMany({
      orderBy: { sortOrder: "asc" },
    });
    expect(userTypes.map((t) => [t.key, t.label])).toEqual([
      ["customer", "Customer"],
      ["doctor", "Ayurveda Doctor"],
      ["clinic", "Clinic / Hospital"],
      ["pharmacy", "Pharmacy / Store"],
      ["stockist", "Stockist / Distributor"],
    ]);
    expect(userTypes[0]).toMatchObject({
      isProfessional: false,
      requiresVerification: false,
      active: true,
    });
    for (const type of userTypes.slice(1)) {
      expect(type).toMatchObject({
        isProfessional: true,
        requiresVerification: true,
        active: true,
      });
    }

    const settings = await db.setting.findMany();
    expect(Object.fromEntries(settings.map((s) => [s.key, s.value]))).toEqual(
      settingDefaults,
    );
    expect(await db.settingHistory.count()).toBe(settings.length);
    expect(summary.settingsCreated).toHaveLength(settings.length);

    const sections = await db.homeSection.findMany({
      orderBy: { sortOrder: "asc" },
    });
    expect(sections.map((s) => s.key)).toEqual([...homeSectionKeys]);
    expect(sections.every((s) => s.enabled)).toBe(true);
  });

  it("is idempotent: a second run changes nothing", async () => {
    await seedDatabase(db);
    const first = await snapshot();

    const summary = await seedDatabase(db);
    expect(summary.settingsCreated).toEqual([]);
    expect(await snapshot()).toEqual(first);
  });

  it("keeps edited settings and homepage content, whatever was changed", async () => {
    await seedDatabase(db);
    await db.setting.update({
      where: { key: "contact.phone" },
      data: { value: "+91 98765 43210" },
    });
    await db.homeSection.update({
      where: { key: "reels" },
      data: { enabled: false, sortOrder: 999, title: "Edited" },
    });
    await db.offer.update({
      where: { key: offerSeed[0].key },
      data: { active: false, title: "Edited" },
    });

    await seedDatabase(db);

    const phone = await db.setting.findUnique({
      where: { key: "contact.phone" },
    });
    expect(phone?.value).toBe("+91 98765 43210");
    expect(await db.settingHistory.count()).toBe(
      Object.keys(settingDefaults).length,
    );
    expect(
      await db.homeSection.findUnique({ where: { key: "reels" } }),
    ).toMatchObject({ enabled: false, sortOrder: 999, title: "Edited" });
    expect(
      await db.offer.findUnique({ where: { key: offerSeed[0].key } }),
    ).toMatchObject({ active: false, title: "Edited" });
  });

  it("never overwrites reels, brands or courses edited in the admin panel", async () => {
    await seedDatabase(db);
    await db.reel.update({
      where: { key: "product-range" },
      data: { active: false, title: "Edited reel" },
    });
    await db.brand.update({
      where: { key: brandSeed[0].key },
      data: { name: "Edited brand" },
    });
    await db.courseTeaser.update({
      where: { key: courseTeaserSeed[0].key },
      data: { title: "Edited course" },
    });
    await db.reel.delete({ where: { key: "brand-launch" } });

    await seedDatabase(db);

    expect(
      await db.reel.findUnique({ where: { key: "product-range" } }),
    ).toMatchObject({ active: false, title: "Edited reel" });
    expect(
      await db.brand.findUnique({ where: { key: brandSeed[0].key } }),
    ).toMatchObject({ name: "Edited brand" });
    expect(
      await db.courseTeaser.findUnique({
        where: { key: courseTeaserSeed[0].key },
      }),
    ).toMatchObject({ title: "Edited course" });
    // A missing seeded row is created again.
    expect(
      await db.reel.findUnique({ where: { key: "brand-launch" } }),
    ).not.toBeNull();
  });

  it("stores every piece of text from the mockup homepage, exactly", async () => {
    await seedDatabase(db);
    const stored = strings(await snapshot()).join("\n");

    const html = readFileSync(resolve(root, "docs/mockup/index.html"), "utf8");
    const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    const texts = main
      .split(/<[^>]+>/)
      .map((piece) =>
        piece
          .replaceAll("&amp;", "&")
          // The mockup predates the rename to "Build Your Brand".
          .replace(/launch your brand/gi, (m) =>
            m.replace(/launch/i, (w) =>
              w === "LAUNCH"
                ? "BUILD"
                : w[0] === "L" && w === "Launch"
                  ? "Build"
                  : "build",
            ),
          )
          .replace(/launch studio/i, "Brand Studio")
          // Leading/trailing decoration that components draw as icons. An
          // arrow inside text ("₹10,000 order → 1,000 Coins") is content.
          .replace(/^[→←✓▶]\s*|\s*[→←✓▶]$/g, "")
          .trim(),
      )
      .filter(Boolean);

    // Shown by the mockup but computed rather than stored: step numbers
    // (01, 02...) come from the order, "S" is the coin emblem, "=" sits in the
    // coin equation, and 40% / +250 / +750 come from the partner section's
    // examplePercent and step coins.
    const derived = new Set(["S", "=", "40%", "+250", "+750"]);
    const missing = texts.filter(
      (text) =>
        !/^\d+$/.test(text) && !derived.has(text) && !stored.includes(text),
    );

    expect(texts.length).toBeGreaterThan(150);
    expect(missing).toEqual([]);
  });

  it("points at media files that exist in public/", () => {
    const paths = [
      ...reelSeed.flatMap((r) => [r.mediaSrc, r.posterSrc]),
      ...feedbackSeed.map((f) => f.imageSrc),
    ].filter((path): path is string => typeof path === "string");

    expect(paths.length).toBeGreaterThanOrEqual(5);
    for (const path of paths) {
      expect(path).toMatch(/^\/media\//);
      expect(existsSync(resolve(root, "public", `.${path}`)), path).toBe(true);
    }
  });
});
