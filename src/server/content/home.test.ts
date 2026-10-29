import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { clearContentTables } from "../../../tests/setup/content-db";
import { contentRevalidateSeconds, contentTags } from "./cache";
import { getHomeContent, type HomeSection } from "./home";
import { homeSectionKeys } from "./home-schema";

// Next's data cache only exists inside a Next server; here each read goes
// straight to the test database. The wrapper's options are still checked.
const { cacheCalls } = vi.hoisted(() => ({ cacheCalls: [] as unknown[][] }));
vi.mock("next/cache", () => ({
  unstable_cache: (read: () => Promise<unknown>, ...options: unknown[]) => {
    cacheCalls.push(options);
    return read;
  },
}));

const keys = async () => (await getHomeContent()).sections.map((s) => s.key);

function section<K extends HomeSection["key"]>(
  sections: HomeSection[],
  key: K,
): Extract<HomeSection, { key: K }> {
  const found = sections.find((s) => s.key === key);
  if (!found) throw new Error(`section ${key} missing`);
  return found as Extract<HomeSection, { key: K }>;
}

beforeEach(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("getHomeContent", () => {
  it("is a cached read tagged for the homepage", () => {
    expect(cacheCalls).toContainEqual([
      ["home:content"],
      { tags: [contentTags.home], revalidate: contentRevalidateSeconds },
    ]);
  });

  it("returns every enabled section in sortOrder", async () => {
    expect(await keys()).toEqual([...homeSectionKeys]);

    await db.homeSection.update({
      where: { key: "why" },
      data: { sortOrder: 1 },
    });
    await db.homeSection.update({
      where: { key: "hero" },
      data: { sortOrder: 1000 },
    });

    const order = await keys();
    expect(order[0]).toBe("why");
    expect(order.at(-1)).toBe("hero");
    expect(order).toHaveLength(homeSectionKeys.length);
  });

  it("leaves out disabled sections", async () => {
    await db.homeSection.updateMany({
      where: { key: { in: ["quiz", "community"] } },
      data: { enabled: false },
    });

    expect(await keys()).toEqual(
      homeSectionKeys.filter((k) => k !== "quiz" && k !== "community"),
    );
  });

  it("ignores section rows it has no renderer for", async () => {
    await db.homeSection.create({
      data: { key: "mystery", sortOrder: 0 },
    });
    expect(await keys()).toEqual([...homeSectionKeys]);
  });

  it("returns only active items, in sortOrder", async () => {
    await db.reel.update({
      where: { key: "product-range" },
      data: { active: false },
    });
    await db.offer.update({
      where: { key: "quiz-and-win" },
      data: { sortOrder: 1 },
    });

    const { sections } = await getHomeContent();
    expect(section(sections, "reels").reels.map((r) => r.key)).toEqual([
      "brand-launch",
      "doctor-feedback-letterhead",
      "saatvik-rewards",
      "nutrition-week-live",
    ]);
    expect(section(sections, "offers").offers.map((o) => o.key)).toEqual([
      "quiz-and-win",
      "saatvik-rewards",
      "private-label",
    ]);
  });

  it("returns the seeded mockup content", async () => {
    const { sections } = await getHomeContent();

    const hero = section(sections, "hero");
    expect(hero.slides.map((s) => s.panel.kind)).toEqual([
      "LAUNCH_STUDIO",
      "BRAND_SHOWCASE",
      "LEARNING_BOARD",
    ]);
    expect(hero.slides[0]).toMatchObject({
      title: "Build your Ayurveda brand.",
      titleEmphasis: "We’ll build the rest.",
      primary: { label: "Build Your Brand", href: "/launch" },
      proof: { initials: ["DR", "AV", "+"] },
    });
    expect(hero.slides[1]?.secondary?.href).toBe("modal:track-order");

    expect(section(sections, "trust").stats).toHaveLength(4);
    expect(section(sections, "reels").filters.FEEDBACK).toBe("Doctor Feedback");

    const launch = section(sections, "launch");
    expect(launch.steps).toHaveLength(3);
    expect(launch.categories.form.map((c) => c.glyph)).toEqual([
      "व",
      "चू",
      "गु",
      "आ",
      "अ",
      "तै",
    ]);
    // Sample practice areas from P1.3.
    expect(launch.categories.practiceArea.map((c) => c.key)).toEqual([
      "kidney-care",
      "digestive-care",
      "liver-care",
      "joint-care",
      "respiratory-care",
      "womens-health",
      "skin-care",
    ]);

    // A brand with no link set goes to its products in the catalogue.
    const brands = section(sections, "brands");
    expect(brands.brands[0]?.link).toEqual({
      label: "Explore range",
      href: "/products?brand=sabka-vaidya",
    });
    expect(brands.heading.link?.href).toBe("/products");

    const courses = section(sections, "courses");
    expect(courses.liveSessions[0]?.body).toBe(
      "प्रकृति, अग्नि एवं रोगावस्था के अनुसार आहार चयन",
    );
    expect(courses.courses[0]?.link).toEqual({
      label: "View course",
      href: null,
    });

    expect(section(sections, "coins").equation.value).toBe("₹1");
    expect(section(sections, "partner").completion.steps).toHaveLength(4);
    expect(section(sections, "feedback").feedback[0]?.featured).toBe(true);
    expect(section(sections, "why").steps.map((s) => s.title)).toEqual([
      "Discover",
      "Build",
      "Grow",
    ]);
  });

  it("drops invalid content and unsafe links instead of failing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await db.homeSection.update({
      where: { key: "quiz" },
      data: { content: { badge: "" } },
    });
    await db.heroSlide.update({
      where: { key: "top-brands" },
      data: { panel: { floatLabel: 42 } },
    });
    await db.quickAction.update({
      where: { key: "launch-your-brand" },
      data: { href: "javascript:alert(1)" },
    });
    await db.offer.update({
      where: { key: "private-label" },
      data: { linkHref: "//evil.example/path" },
    });
    await db.reel.update({
      where: { key: "brand-launch" },
      data: { mediaSrc: "https://evil.example/x.mp4" },
    });

    const { sections } = await getHomeContent();

    expect(sections.map((s) => s.key)).not.toContain("quiz");
    expect(section(sections, "hero").slides.map((s) => s.key)).toEqual([
      "launch-your-brand",
      "clinical-learning",
    ]);
    const action = section(sections, "quick-actions").actions[0];
    expect(action?.href).toBeNull();
    const offer = section(sections, "offers").offers.find(
      (o) => o.key === "private-label",
    );
    expect(offer?.link.href).toBeNull();
    expect(section(sections, "reels").reels[0]?.mediaSrc).toBeNull();
    expect(log).toHaveBeenCalled();

    log.mockRestore();
  });
});
