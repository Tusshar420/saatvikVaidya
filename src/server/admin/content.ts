import "server-only";
import { z } from "zod";
import { admin as copy } from "@/content/admin";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import {
  createdFields,
  diffFields,
  logAdminAction,
  type AdminAction,
  type AdminResource,
} from "./audit";
import {
  blankToNull,
  checkbox,
  contentKey,
  optionalLinkTarget,
  optionalMediaPath,
  optionalText,
  requiredText,
  sortOrder,
} from "./form";

// Homepage content managed in the admin panel: reels, brands and courses.
// Each row keeps the `key` it was created with (the seed upserts by key).
// Callers check the admin session, then revalidate the homepage cache.

const common = copy.common;
const tones = ["ORANGE", "TEAL", "BLUE", "GOLD", "NAVY", "GREEN"] as const;
const check = "Check this field.";

const placement = {
  sortOrder: sortOrder(check),
  active: checkbox,
};

export type ContentResult =
  | { ok: true; id: number }
  | { ok: false; fieldErrors: Record<string, string> };

/** Unique-key clash (Prisma P2002) on `key`. */
function isKeyClash(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

// ─── Reels ──────────────────────────────────────────────────────────────────

const reelErrors = copy.reels.errors;

export const reelInputSchema = z
  .object({
    title: requiredText(200, check),
    mediaKind: z.enum(["VIDEO", "IMAGE", "POSTER"], { error: check }),
    type: z.enum(["PRODUCT", "FEEDBACK", "LEARNING", "OFFER"], { error: check }),
    mediaSrc: optionalMediaPath(reelErrors.path),
    posterSrc: optionalMediaPath(reelErrors.path),
    mediaLabel: optionalText(200, check),
    badge: optionalText(60, check),
    badgeTone: z.preprocess(
      blankToNull,
      z.enum(tones, { error: check }).nullable(),
    ),
    metaLabel: optionalText(60, check),
    valueLabel: optionalText(60, check),
    posterKicker: optionalText(80, check),
    posterText: optionalText(200, check),
    posterByline: optionalText(80, check),
    linkLabel: requiredText(80, check),
    linkHref: optionalLinkTarget(reelErrors.link),
    ...placement,
  })
  .superRefine((reel, ctx) => {
    if (reel.mediaKind !== "POSTER" && !reel.mediaSrc) {
      ctx.addIssue({
        code: "custom",
        path: ["mediaSrc"],
        message: reelErrors.mediaRequired,
      });
    }
    if (reel.mediaKind === "POSTER" && !reel.posterText) {
      ctx.addIssue({
        code: "custom",
        path: ["posterText"],
        message: reelErrors.posterTextRequired,
      });
    }
  });

export type ReelInput = z.infer<typeof reelInputSchema>;

export async function listReels() {
  return db.reel.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}

export async function getReel(id: number) {
  return db.reel.findUnique({ where: { id } });
}

// ─── Brands ─────────────────────────────────────────────────────────────────

const brandErrors = copy.brands.errors;

export const brandInputSchema = z.object({
  name: requiredText(80, check),
  monogram: requiredText(4, check),
  logoSrc: optionalMediaPath(brandErrors.path),
  tone: z.enum(tones, { error: check }),
  eyebrow: requiredText(80, check),
  description: requiredText(300, check),
  linkLabel: requiredText(80, check),
  linkHref: optionalLinkTarget(brandErrors.link),
  featured: checkbox,
  ...placement,
});

export type BrandInput = z.infer<typeof brandInputSchema>;

export async function listBrands() {
  return db.brand.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}

export async function getBrand(id: number) {
  return db.brand.findUnique({ where: { id } });
}

// ─── Courses ────────────────────────────────────────────────────────────────

const courseErrors = copy.courses.errors;

const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
]);

/** An https link on YouTube, or null when blank. */
export const youtubeUrlSchema = z.preprocess(
  blankToNull,
  z
    .string({ error: courseErrors.videoUrl })
    .trim()
    .max(300, courseErrors.videoUrl)
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && youtubeHosts.has(url.hostname);
      } catch {
        return false;
      }
    }, courseErrors.videoUrl)
    .nullable(),
);

export const courseInputSchema = z.object({
  title: requiredText(160, check),
  tag: requiredText(60, check),
  body: requiredText(300, check),
  instructor: optionalText(80, check),
  duration: optionalText(40, check),
  metaLabel: requiredText(40, check),
  metaValue: requiredText(80, check),
  videoUrl: youtubeUrlSchema,
  linkLabel: requiredText(80, check),
  linkHref: optionalLinkTarget(courseErrors.link),
  ...placement,
});

export type CourseInput = z.infer<typeof courseInputSchema>;

export async function listCourses() {
  return db.courseTeaser.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

export async function getCourse(id: number) {
  return db.courseTeaser.findUnique({ where: { id } });
}

// ─── Shared create / update / delete ────────────────────────────────────────

export const keySchema = contentKey(common.keyHelp);

/**
 * The three content tables share the same shape of operations; this maps a
 * kind to its Prisma delegate, audit names and key-clash message.
 */
export type ContentKind = "reel" | "brand" | "course";

const kinds: Record<
  ContentKind,
  {
    resource: AdminResource;
    keyTaken: string;
    delegate: (tx: Prisma.TransactionClient) => ContentDelegate;
  }
> = {
  reel: {
    resource: "Reel",
    keyTaken: reelErrors.keyTaken,
    delegate: (tx) => tx.reel as unknown as ContentDelegate,
  },
  brand: {
    resource: "Brand",
    keyTaken: brandErrors.keyTaken,
    delegate: (tx) => tx.brand as unknown as ContentDelegate,
  },
  course: {
    resource: "CourseTeaser",
    keyTaken: courseErrors.keyTaken,
    delegate: (tx) => tx.courseTeaser as unknown as ContentDelegate,
  },
};

/**
 * The subset of a Prisma delegate used here. The three models have different
 * generated types, so they're narrowed to this common shape (the inputs are
 * already checked by each kind's Zod schema).
 */
type ContentDelegate = {
  findUnique(args: { where: { id: number } }): Promise<Record<
    string,
    unknown
  > | null>;
  create(args: { data: Record<string, unknown> }): Promise<{ id: number }>;
  update(args: {
    where: { id: number };
    data: Record<string, unknown>;
  }): Promise<unknown>;
  delete(args: { where: { id: number } }): Promise<unknown>;
};

export async function createContent(
  kind: ContentKind,
  key: string,
  input: ReelInput | BrandInput | CourseInput,
  actorId: string,
): Promise<ContentResult> {
  const { resource, keyTaken, delegate } = kinds[kind];
  try {
    return await db.$transaction(async (tx) => {
      const row = await delegate(tx).create({ data: { key, ...input } });
      await logAdminAction(tx, {
        actorId,
        action: `${kind}.create` as AdminAction,
        resource,
        resourceId: row.id,
        changes: createdFields({ key, ...input }),
      });
      return { ok: true as const, id: row.id };
    });
  } catch (error) {
    if (isKeyClash(error)) return { ok: false, fieldErrors: { key: keyTaken } };
    throw error;
  }
}

/** Null when the row no longer exists. */
export async function updateContent(
  kind: ContentKind,
  id: number,
  input: ReelInput | BrandInput | CourseInput,
  actorId: string,
): Promise<ContentResult | null> {
  const { resource, delegate } = kinds[kind];
  return db.$transaction(async (tx) => {
    const existing = await delegate(tx).findUnique({ where: { id } });
    if (!existing) return null;
    const changes = diffFields(existing, input);
    if (Object.keys(changes).length === 0) return { ok: true, id };
    await delegate(tx).update({ where: { id }, data: input });
    await logAdminAction(tx, {
      actorId,
      action: `${kind}.update` as AdminAction,
      resource,
      resourceId: id,
      changes,
    });
    return { ok: true, id };
  });
}

/** False when the row no longer exists. */
export async function deleteContent(
  kind: ContentKind,
  id: number,
  actorId: string,
): Promise<boolean> {
  const { resource, delegate } = kinds[kind];
  return db.$transaction(async (tx) => {
    const existing = await delegate(tx).findUnique({ where: { id } });
    if (!existing) return false;
    await delegate(tx).delete({ where: { id } });
    await logAdminAction(tx, {
      actorId,
      action: `${kind}.delete` as AdminAction,
      resource,
      resourceId: id,
      changes: createdFields({ key: existing.key }),
    });
    return true;
  });
}
