import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { readHomeContent } from "@/server/content/home";
import { seedDatabase } from "@/server/seed";
import { resetAuthData, userTypeIds } from "../../../tests/setup/auth";
import { clearContentTables } from "../../../tests/setup/content-db";
import { fieldErrorsOf } from "./form";
import {
  createHomeRow,
  deleteHomeRow,
  homeInputSchemas,
  listHomeRows,
  parseSectionsForm,
  updateHomeRow,
  updateSections,
} from "./home-content";

const adminId = "home-admin";

const offerForm = {
  tone: "GOLD",
  iconText: "★",
  eyebrow: "NEW",
  title: "Festival offer",
  body: "Ten percent off.",
  linkLabel: "See the offer",
  linkHref: "/coins",
  sortOrder: "1",
  active: "on",
};

beforeEach(async () => {
  await clearContentTables(db);
  await resetAuthData(db);
  const types = await userTypeIds(db);
  await db.user.create({
    data: {
      id: adminId,
      name: "Home Admin",
      email: "home-admin@example.test",
      role: "admin",
      userTypeId: types.customer,
      termsAcceptedAt: new Date(),
    },
  });
  await seedDatabase(db);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("homepage items", () => {
  it("an edited item shows on the homepage content", async () => {
    const [first] = await listHomeRows("offer");
    const input = homeInputSchemas.offer.parse({ ...offerForm, title: "Edited offer title" });
    expect(await updateHomeRow("offer", first.id as number, input, adminId)).toMatchObject({ ok: true });

    const home = await readHomeContent();
    const offers = home.sections.find((s) => s.key === "offers");
    expect(offers?.key === "offers" && offers.offers.map((o) => o.title)).toContain("Edited offer title");
    const log = await db.adminLog.findFirst({ where: { resource: "Offer", action: "home.update" } });
    expect(log?.userId).toBe(adminId);
  });

  it("creates an item, rejects a repeated key, and deletes", async () => {
    const input = homeInputSchemas.offer.parse(offerForm);
    const created = await createHomeRow("offer", "festival-offer", input, adminId);
    expect(created.ok).toBe(true);
    expect(await createHomeRow("offer", "festival-offer", input, adminId)).toEqual({
      ok: false,
      fieldErrors: { key: expect.any(String) },
    });
    if (created.ok) expect(await deleteHomeRow("offer", created.id, adminId)).toBe(true);
    expect(await db.offer.findUnique({ where: { key: "festival-offer" } })).toBeNull();
  });

  it("rejects an unsafe link target and a hero panel of the wrong shape", () => {
    const bad = homeInputSchemas.offer.safeParse({ ...offerForm, linkHref: "javascript:alert(1)" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(fieldErrorsOf(bad.error)).toHaveProperty("linkHref");

    const slide = homeInputSchemas.hero.safeParse({
      eyebrow: "E",
      title: "T",
      body: "B",
      primaryLabel: "Go",
      panelKind: "LAUNCH_STUDIO",
      panel: '{"label":"x"}',
      sortOrder: "1",
    });
    expect(slide.success).toBe(false);
    if (!slide.success) expect(fieldErrorsOf(slide.error)).toHaveProperty("panel");
  });
});

describe("sections", () => {
  it("switching a section off and changing the order shows on the homepage", async () => {
    const parsed = parseSectionsForm({
      "enabled:hero": "on",
      "order:hero": "1",
      "enabled:trust": "on",
      "order:trust": "99",
      "enabled:offers": "on",
      "order:offers": "5",
      ...Object.fromEntries(
        ["reels", "quick-actions", "launch", "brands", "courses", "coins", "quiz", "feedback", "community", "partner", "why"].map(
          (key) => [`order:${key}`, "50"],
        ),
      ),
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await updateSections(adminId, parsed.rows);

    const keys = (await readHomeContent()).sections.map((s) => s.key);
    expect(keys).toEqual(["hero", "offers", "trust"]);
  });

  it("rejects a non-numeric order", () => {
    const parsed = parseSectionsForm({ "order:hero": "abc" });
    expect(parsed.ok).toBe(false);
  });
});

describe("re-seeding", () => {
  it("never overwrites homepage content edited in the admin panel", async () => {
    const [first] = await listHomeRows("offer");
    await updateHomeRow(
      "offer",
      first.id as number,
      homeInputSchemas.offer.parse({ ...offerForm, title: "Mine", active: undefined }),
      adminId,
    );
    await db.statItem.updateMany({ data: { value: "999+" } });
    await db.homeSection.update({ where: { key: "why" }, data: { enabled: false } });

    await seedDatabase(db);

    expect(await db.offer.findUnique({ where: { id: first.id as number } })).toMatchObject({
      title: "Mine",
      active: false,
    });
    expect((await db.statItem.findFirst())?.value).toBe("999+");
    expect((await db.homeSection.findUnique({ where: { key: "why" } }))?.enabled).toBe(false);
  });
});
