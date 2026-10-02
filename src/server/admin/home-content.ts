import "server-only";
import { z } from "zod";
import { adminHome as copy, type HomeKindKey } from "@/content/admin-site";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import {
  heroPanelSchemas,
  heroProofSchema,
  homeSectionKeys,
  isHomeSectionKey,
  sitePathSchema,
} from "@/server/content/home-schema";
import {
  createdFields,
  diffFields,
  logAdminAction,
  type AdminResource,
} from "./audit";
import {
  checkbox,
  optionalLinkTarget,
  optionalText,
  requiredText,
  sortOrder,
} from "./form";

// The rest of the homepage content, managed in /admin/content: hero slides,
// offers, trust stats, quick actions, categories, feedback and the "Why
// Saatvik" steps, plus each section's on/off, order and heading. Callers
// check the admin session, then expire the homepage cache.

const check = "Check this field.";
const link = "Use a site path such as \"/coins\", or \"modal:sign-in\".";
const tones = ["ORANGE", "TEAL", "BLUE", "GOLD", "NAVY", "GREEN"] as const;

const placement = { sortOrder: sortOrder(check), active: checkbox };

/** JSON typed into a textarea; blank is null, invalid JSON stays a string so the schema rejects it. */
const jsonText = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}, z.unknown());

const heroInput = z
  .object({
    eyebrow: requiredText(80, check),
    title: requiredText(160, check),
    titleEmphasis: optionalText(160, check),
    body: requiredText(400, check),
    primaryLabel: requiredText(80, check),
    primaryHref: optionalLinkTarget(link),
    secondaryLabel: optionalText(80, check),
    secondaryHref: optionalLinkTarget(link),
    panelKind: z.enum(["LAUNCH_STUDIO", "BRAND_SHOWCASE", "LEARNING_BOARD"], { error: check }),
    panel: jsonText,
    proof: jsonText,
    ...placement,
  })
  .superRefine((slide, ctx) => {
    const panel = heroPanelSchemas[slide.panelKind].safeParse(slide.panel);
    if (!panel.success) {
      ctx.addIssue({ code: "custom", path: ["panel"], message: copy.jsonError });
    }
    if (slide.proof !== null && !heroProofSchema.safeParse(slide.proof).success) {
      ctx.addIssue({ code: "custom", path: ["proof"], message: copy.jsonError });
    }
  });

export const homeInputSchemas = {
  hero: heroInput,
  offer: z.object({
    tone: z.enum(tones, { error: check }),
    iconText: requiredText(8, check),
    eyebrow: requiredText(80, check),
    title: requiredText(160, check),
    body: requiredText(300, check),
    linkLabel: requiredText(80, check),
    linkHref: optionalLinkTarget(link),
    ...placement,
  }),
  stat: z.object({
    value: requiredText(40, check),
    label: requiredText(80, check),
    ...placement,
  }),
  "quick-action": z.object({
    tone: z.enum(tones, { error: check }),
    iconText: requiredText(8, check),
    title: requiredText(80, check),
    description: requiredText(160, check),
    href: optionalLinkTarget(link),
    ...placement,
  }),
  category: z.object({
    kind: z.enum(["FORM", "PRACTICE_AREA"], { error: check }),
    name: requiredText(80, check),
    glyph: optionalText(8, check),
    ...placement,
  }),
  feedback: z.object({
    // A site path under public/.
    imageSrc: z
      .string({ error: check })
      .trim()
      .min(1, check)
      .refine((value) => sitePathSchema.safeParse(value).success, check),
    imageAlt: requiredText(200, check),
    badge: requiredText(60, check),
    quote: requiredText(600, check),
    caption: requiredText(160, check),
    linkLabel: requiredText(80, check),
    linkHref: optionalLinkTarget(link),
    featured: checkbox,
    ...placement,
  }),
  why: z.object({
    title: requiredText(80, check),
    body: requiredText(300, check),
    ...placement,
  }),
} satisfies Record<HomeKindKey, z.ZodType>;

export type HomeInput<K extends HomeKindKey = HomeKindKey> = z.infer<(typeof homeInputSchemas)[K]>;

/** The Prisma delegate and audit name of each kind. */
const kinds: Record<
  HomeKindKey,
  { resource: AdminResource; delegate: (tx: Prisma.TransactionClient) => Delegate }
> = {
  hero: { resource: "HeroSlide", delegate: (tx) => tx.heroSlide as unknown as Delegate },
  offer: { resource: "Offer", delegate: (tx) => tx.offer as unknown as Delegate },
  stat: { resource: "StatItem", delegate: (tx) => tx.statItem as unknown as Delegate },
  "quick-action": { resource: "QuickAction", delegate: (tx) => tx.quickAction as unknown as Delegate },
  category: { resource: "Category", delegate: (tx) => tx.category as unknown as Delegate },
  feedback: { resource: "Feedback", delegate: (tx) => tx.feedback as unknown as Delegate },
  why: { resource: "WhyStep", delegate: (tx) => tx.whyStep as unknown as Delegate },
};

/**
 * The part of a Prisma delegate used here. The models have different
 * generated types, so they're narrowed to this common shape; the data is
 * already checked by each kind's Zod schema.
 */
type Delegate = {
  findMany(args: { orderBy: { sortOrder: "asc" }[] }): Promise<Record<string, unknown>[]>;
  findUnique(args: { where: { id: number } }): Promise<Record<string, unknown> | null>;
  create(args: { data: Record<string, unknown> }): Promise<{ id: number }>;
  update(args: { where: { id: number }; data: Record<string, unknown> }): Promise<unknown>;
  delete(args: { where: { id: number } }): Promise<unknown>;
};

export type HomeResult =
  | { ok: true; id: number }
  | { ok: false; fieldErrors: Record<string, string> };

function isKeyClash(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "P2002";
}

export async function listHomeRows(kind: HomeKindKey): Promise<Record<string, unknown>[]> {
  return (kinds[kind].delegate(db as unknown as Prisma.TransactionClient)).findMany({
    orderBy: [{ sortOrder: "asc" }],
  });
}

export async function getHomeRow(kind: HomeKindKey, id: number) {
  return kinds[kind].delegate(db as unknown as Prisma.TransactionClient).findUnique({ where: { id } });
}

/** Form-ready values (JSON columns as pretty text). */
export function homeFormValues(row: Record<string, unknown>) {
  const values: Record<string, string | number | boolean | null> = {};
  for (const [name, value] of Object.entries(row)) {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      values[name] = value;
    } else if (name === "panel" || name === "proof") {
      values[name] = JSON.stringify(value, null, 2);
    }
  }
  return values;
}

export async function createHomeRow(
  kind: HomeKindKey,
  key: string,
  input: Record<string, unknown>,
  actorId: string,
): Promise<HomeResult> {
  const { resource, delegate } = kinds[kind];
  try {
    return await db.$transaction(async (tx) => {
      const row = await delegate(tx).create({ data: { key, ...input } });
      await logAdminAction(tx, {
        actorId,
        action: "home.create",
        resource,
        resourceId: row.id,
        changes: createdFields({ key, ...flat(input) }),
      });
      return { ok: true as const, id: row.id };
    });
  } catch (error) {
    if (isKeyClash(error)) return { ok: false, fieldErrors: { key: copy.keyTaken } };
    throw error;
  }
}

/** Null when the row no longer exists. */
export async function updateHomeRow(
  kind: HomeKindKey,
  id: number,
  input: Record<string, unknown>,
  actorId: string,
): Promise<HomeResult | null> {
  const { resource, delegate } = kinds[kind];
  return db.$transaction(async (tx) => {
    const existing = await delegate(tx).findUnique({ where: { id } });
    if (!existing) return null;
    const changes = diffFields(flat(existing), flat(input));
    if (Object.keys(changes).length === 0) return { ok: true as const, id };
    await delegate(tx).update({ where: { id }, data: input });
    await logAdminAction(tx, { actorId, action: "home.update", resource, resourceId: id, changes });
    return { ok: true as const, id };
  });
}

export async function deleteHomeRow(kind: HomeKindKey, id: number, actorId: string): Promise<boolean> {
  const { resource, delegate } = kinds[kind];
  return db.$transaction(async (tx) => {
    const existing = await delegate(tx).findUnique({ where: { id } });
    if (!existing) return false;
    await delegate(tx).delete({ where: { id } });
    await logAdminAction(tx, {
      actorId,
      action: "home.delete",
      resource,
      resourceId: id,
      changes: createdFields({ key: existing.key }),
    });
    return true;
  });
}

/** JSON columns as text so the audit log can show them. */
function flat(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      value !== null && typeof value === "object" && !(value instanceof Date) ? JSON.stringify(value) : value,
    ]),
  );
}

// ─── Sections ───────────────────────────────────────────────────────────────

export async function listSections() {
  const rows = await db.homeSection.findMany({ orderBy: [{ sortOrder: "asc" }, { key: "asc" }] });
  return rows.filter((row) => isHomeSectionKey(row.key));
}

const orderField = z.coerce.number({ error: check }).int(check).min(-100_000, check).max(100_000, check);

/** The "shown" and "order" inputs of every section, keyed `enabled:<key>` and `order:<key>`. */
export function parseSectionsForm(values: Record<string, string>) {
  const rows: { key: string; enabled: boolean; sortOrder: number }[] = [];
  const fieldErrors: Record<string, string> = {};
  for (const key of homeSectionKeys) {
    const order = orderField.safeParse(values[`order:${key}`]);
    if (!order.success) {
      fieldErrors[`order:${key}`] = copy.sections.errors.order;
      continue;
    }
    rows.push({ key, enabled: values[`enabled:${key}`] === "on", sortOrder: order.data });
  }
  return Object.keys(fieldErrors).length > 0
    ? ({ ok: false, fieldErrors } as const)
    : ({ ok: true, rows } as const);
}

export async function updateSections(
  actorId: string,
  rows: { key: string; enabled: boolean; sortOrder: number }[],
): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const row of rows) {
      const existing = await tx.homeSection.findUnique({ where: { key: row.key } });
      if (!existing) continue;
      const changes = diffFields(existing, { enabled: row.enabled, sortOrder: row.sortOrder });
      if (Object.keys(changes).length === 0) continue;
      await tx.homeSection.update({
        where: { key: row.key },
        data: { enabled: row.enabled, sortOrder: row.sortOrder },
      });
      await logAdminAction(tx, {
        actorId,
        action: "home.sections.update",
        resource: "HomeSection",
        resourceId: row.key,
        changes,
      });
    }
  });
}

export const sectionHeadingSchema = z.object({
  eyebrow: optionalText(80, check),
  title: optionalText(160, check),
  titleEmphasis: optionalText(160, check),
  description: optionalText(400, check),
  linkLabel: optionalText(80, check),
  linkHref: optionalLinkTarget(link),
});

export async function getSection(key: string) {
  if (!isHomeSectionKey(key)) return null;
  return db.homeSection.findUnique({ where: { key } });
}

/** False when the section doesn't exist. */
export async function updateSectionHeading(
  actorId: string,
  key: string,
  input: z.infer<typeof sectionHeadingSchema>,
): Promise<boolean> {
  if (!isHomeSectionKey(key)) return false;
  return db.$transaction(async (tx) => {
    const existing = await tx.homeSection.findUnique({ where: { key } });
    if (!existing) return false;
    const changes = diffFields(existing, input);
    if (Object.keys(changes).length > 0) {
      await tx.homeSection.update({ where: { key }, data: input });
      await logAdminAction(tx, {
        actorId,
        action: "home.sections.update",
        resource: "HomeSection",
        resourceId: key,
        changes,
      });
    }
    return true;
  });
}
