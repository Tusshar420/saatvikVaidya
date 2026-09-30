import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { clearContentTables } from "../../../tests/setup/content-db";
import { resetAuthData, userTypeIds } from "../../../tests/setup/auth";
import {
  brandInputSchema,
  courseInputSchema,
  createContent,
  deleteContent,
  keySchema,
  reelInputSchema,
  updateContent,
  youtubeUrlSchema,
} from "./content";
import { fieldErrorsOf } from "./form";

const adminId = "content-admin";

const reelForm = {
  title: "A new reel",
  mediaKind: "IMAGE",
  type: "OFFER",
  mediaSrc: "/media/saatvik-rewards.jpg",
  posterSrc: "",
  mediaLabel: "Rewards poster",
  badge: "NEW",
  badgeTone: "GOLD",
  metaLabel: "",
  valueLabel: "",
  posterKicker: "",
  posterText: "",
  posterByline: "",
  linkLabel: "See rewards",
  linkHref: "/coins",
  sortOrder: "50",
  active: "on",
};

const brandForm = {
  name: "Test Brand",
  monogram: "TB",
  logoSrc: "",
  tone: "TEAL",
  eyebrow: "NEW RANGE",
  description: "A brand for tests.",
  linkLabel: "View products",
  linkHref: "",
  sortOrder: "5",
};

const courseForm = {
  title: "Test Course",
  tag: "SHORT COURSE",
  body: "What it covers.",
  instructor: "Dr Test",
  duration: "2 days",
  metaLabel: "Format",
  metaValue: "Online",
  videoUrl: "https://www.youtube.com/watch?v=abc123",
  linkLabel: "View course",
  linkHref: "",
  sortOrder: "10",
  active: "on",
};

beforeEach(async () => {
  await clearContentTables(db);
  await resetAuthData(db);
  const types = await userTypeIds(db);
  await db.user.create({
    data: {
      id: adminId,
      name: "Content Admin",
      email: "content-admin@example.test",
      role: "admin",
      userTypeId: types.customer,
      termsAcceptedAt: new Date(),
    },
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("reels", () => {
  it("parses the form: blanks become null and the checkbox a boolean", () => {
    const reel = reelInputSchema.parse(reelForm);
    expect(reel).toMatchObject({
      posterSrc: null,
      metaLabel: null,
      badgeTone: "GOLD",
      sortOrder: 50,
      active: true,
    });
    expect(reelInputSchema.parse({ ...reelForm, active: undefined }).active).toBe(
      false,
    );
  });

  it("needs media for images and videos, and text for quote posters", () => {
    const noMedia = reelInputSchema.safeParse({ ...reelForm, mediaSrc: "" });
    expect(noMedia.success).toBe(false);
    if (!noMedia.success) expect(fieldErrorsOf(noMedia.error)).toHaveProperty("mediaSrc");

    const poster = reelInputSchema.safeParse({
      ...reelForm,
      mediaKind: "POSTER",
      mediaSrc: "",
    });
    expect(poster.success).toBe(false);
    if (!poster.success) expect(fieldErrorsOf(poster.error)).toHaveProperty("posterText");

    expect(
      reelInputSchema.safeParse({
        ...reelForm,
        mediaKind: "POSTER",
        mediaSrc: "",
        posterText: "सत्य\nवचन",
      }).success,
    ).toBe(true);
  });

  it("refuses off-site media and unsafe links", () => {
    for (const mediaSrc of [
      "https://evil.example/x.jpg",
      "//evil.example/x.jpg",
      "javascript:alert(1)",
    ]) {
      expect(reelInputSchema.safeParse({ ...reelForm, mediaSrc }).success).toBe(
        false,
      );
    }
    for (const linkHref of [
      "https://evil.example",
      "//evil.example",
      "javascript:alert(1)",
      "modal:unknown",
    ]) {
      expect(reelInputSchema.safeParse({ ...reelForm, linkHref }).success).toBe(
        false,
      );
    }
    expect(
      reelInputSchema.safeParse({ ...reelForm, linkHref: "modal:sign-in" })
        .success,
    ).toBe(true);
  });

  it("creates, updates and deletes, logging each change", async () => {
    const created = await createContent(
      "reel",
      "test-reel",
      reelInputSchema.parse(reelForm),
      adminId,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateContent(
      "reel",
      created.id,
      reelInputSchema.parse({ ...reelForm, title: "Renamed", active: undefined }),
      adminId,
    );
    expect(updated).toEqual({ ok: true, id: created.id });
    expect(await db.reel.findUnique({ where: { id: created.id } })).toMatchObject(
      { key: "test-reel", title: "Renamed", active: false },
    );

    expect(await deleteContent("reel", created.id, adminId)).toBe(true);
    expect(await db.reel.count()).toBe(0);

    const logs = await db.adminLog.findMany({
      where: { resource: "Reel", resourceId: String(created.id) },
      orderBy: { id: "asc" },
    });
    expect(logs.map((log) => log.action)).toEqual([
      "reel.create",
      "reel.update",
      "reel.delete",
    ]);
    expect(logs[1].changes).toEqual({
      title: { from: "A new reel", to: "Renamed" },
      active: { from: true, to: false },
    });
  });

  it("reports a key that's already used, and a missing row", async () => {
    const reel = reelInputSchema.parse(reelForm);
    await createContent("reel", "same-key", reel, adminId);
    expect(await createContent("reel", "same-key", reel, adminId)).toEqual({
      ok: false,
      fieldErrors: { key: expect.any(String) },
    });
    expect(await updateContent("reel", 999_999, reel, adminId)).toBeNull();
    expect(await deleteContent("reel", 999_999, adminId)).toBe(false);
  });
});

describe("keys", () => {
  it("accepts slug keys only", () => {
    expect(keySchema.parse("  New-Reel-2 ")).toBe("new-reel-2");
    for (const bad of ["", "has space", "-leading", "trailing-", "a--b", "x/y"]) {
      expect(keySchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("brands", () => {
  it("creates and edits a brand with a logo path", async () => {
    const created = await createContent(
      "brand",
      "test-brand",
      brandInputSchema.parse(brandForm),
      adminId,
    );
    if (!created.ok) throw new Error("create failed");
    await updateContent(
      "brand",
      created.id,
      brandInputSchema.parse({
        ...brandForm,
        logoSrc: "/media/brands/test.png",
        featured: "on",
      }),
      adminId,
    );
    expect(await db.brand.findUnique({ where: { id: created.id } })).toMatchObject({
      logoSrc: "/media/brands/test.png",
      featured: true,
      active: false,
    });
  });

  it("needs a monogram of up to 4 characters and a known colour", () => {
    expect(brandInputSchema.safeParse({ ...brandForm, monogram: "" }).success).toBe(false);
    expect(brandInputSchema.safeParse({ ...brandForm, monogram: "ABCDE" }).success).toBe(false);
    expect(brandInputSchema.safeParse({ ...brandForm, tone: "PINK" }).success).toBe(false);
  });
});

describe("courses", () => {
  it("creates a course with instructor, duration and a YouTube link", async () => {
    const created = await createContent(
      "course",
      "test-course",
      courseInputSchema.parse(courseForm),
      adminId,
    );
    if (!created.ok) throw new Error("create failed");
    expect(
      await db.courseTeaser.findUnique({ where: { id: created.id } }),
    ).toMatchObject({
      instructor: "Dr Test",
      duration: "2 days",
      videoUrl: "https://www.youtube.com/watch?v=abc123",
    });
  });

  it("accepts only https YouTube links", () => {
    for (const ok of [
      "https://youtu.be/abc",
      "https://www.youtube.com/embed/abc",
      "https://www.youtube-nocookie.com/embed/abc",
      "",
    ]) {
      expect(youtubeUrlSchema.safeParse(ok).success, ok).toBe(true);
    }
    for (const bad of [
      "http://www.youtube.com/watch?v=abc",
      "https://evil.example/youtube.com",
      "https://youtube.com.evil.example/x",
      "javascript:alert(1)",
      "not a url",
    ]) {
      expect(youtubeUrlSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});
