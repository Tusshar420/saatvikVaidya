import "server-only";
import { updateTag } from "next/cache";
import { z } from "zod";
import { adminSettings as copy } from "@/content/admin-site";
import { settingDefaults, type SettingKey, type SettingValues } from "@/content/settings";
import { db } from "@/server/db";
import { contentTags } from "@/server/content/cache";
import { getSetting, settingSchemas } from "@/server/content/settings";
import { diffFields, logAdminAction } from "./audit";
import { blankToNull, checkbox, fieldErrorsOf, optionalLinkTarget } from "./form";

// Editing site settings from /admin/settings. Every changed setting writes
// the value, a SettingHistory row and an AdminLog row together, then expires
// the cached settings so the site shows the change at once. Call it from a
// server action (updateTag only works there).

export type SettingsGroup = "contact" | "announcement" | "shipping" | "discount" | "payment" | "seller" | "switches";

export const settingsGroups: readonly SettingsGroup[] = [
  "contact",
  "announcement",
  "shipping",
  "discount",
  "payment",
  "seller",
  "switches",
];

const errors = copy.errors;

const lines = (max: number, min: number, limit: number, message: string) =>
  z
    .string({ error: message })
    .transform((value) =>
      value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(max, message)).min(min, message).max(limit, message));

const text = (max: number, message: string) =>
  z.string({ error: message }).trim().min(1, message).max(max, message);

/** Rupees as typed ("80", "99.50") to whole paise. */
const rupees = (max: number, message: string) =>
  z
    .string({ error: message })
    .trim()
    .regex(/^\d{1,9}(\.\d{1,2})?$/, message)
    .transform((value) => Math.round(Number(value) * 100))
    .pipe(z.number().max(max, message));

const forms = {
  contact: z.object({
    phone: z.string({ error: errors.phone }).trim().regex(/^\+91 [6-9]\d{4} \d{5}$/, errors.phone),
    supportNote: text(300, errors.text),
    footerTagline: text(200, errors.text),
    popularSearches: lines(60, 1, 8, errors.list),
  }),
  announcement: z
    .object({
      enabled: checkbox,
      text: z.string({ error: errors.text }).trim().max(200, errors.text),
      href: optionalLinkTarget(errors.link),
    })
    .refine((v) => !v.enabled || v.text.length > 0, {
      path: ["text"],
      message: errors.announcementText,
    }),
  shipping: z.object({
    fee: rupees(10_000_000, errors.money),
    freeFrom: z.preprocess(blankToNull, rupees(1_000_000_000, errors.money).nullable()),
  }),
  discount: z.object({
    percent: z
      .string({ error: errors.percent })
      .trim()
      .regex(/^\d{1,2}$/, errors.percent)
      .transform(Number)
      .pipe(z.number().min(0, errors.percent).max(90, errors.percent)),
  }),
  payment: z.object({
    payeeName: text(80, errors.text),
    upiId: z.string({ error: errors.upi }).trim().max(80, errors.upi),
    bankName: z.string({ error: errors.text }).trim().max(80, errors.text),
    accountNumber: z.string({ error: errors.account }).trim().max(24, errors.account),
    ifsc: z.string({ error: errors.ifsc }).trim().toUpperCase().max(11, errors.ifsc),
    note: z.string({ error: errors.text }).trim().max(300, errors.text),
  }),
  seller: z.object({
    legalName: text(120, errors.text),
    addressLines: lines(120, 1, 3, errors.addressLines),
    city: text(100, errors.text),
    stateCode: z.string({ error: errors.state }),
    pincode: z.string({ error: errors.pincode }).trim().regex(/^[1-8]\d{5}$/, errors.pincode),
    gstin: z.string({ error: errors.gstin }).trim().toUpperCase(),
  }),
  switches: z.object({
    checkout: checkbox,
    coins: checkbox,
    ebooks: checkbox,
    maintenance: checkbox,
    maintenanceMessage: text(300, errors.text),
  }),
} satisfies Record<SettingsGroup, z.ZodType>;

/** The setting values a validated group form turns into. */
type Changes = { [K in SettingKey]?: SettingValues[K] };

export type ParsedSettings =
  | { ok: true; changes: Changes }
  | { ok: false; fieldErrors: Record<string, string> };

/**
 * Checks one group's form values and maps them to setting values. Each value
 * is also run through the setting's own schema, the same one the site uses
 * to read it, so nothing the site would ignore can be saved.
 */
export function parseSettingsForm(
  group: SettingsGroup,
  values: Record<string, string>,
  current: Pick<SettingValues, "coins.rules">,
): ParsedSettings {
  const parsed = forms[group].safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const changes: Changes = {};
  switch (group) {
    case "contact": {
      const v = parsed.data as z.infer<typeof forms.contact>;
      changes["contact.phone"] = v.phone;
      changes["contact.supportNote"] = v.supportNote;
      changes["footer.tagline"] = v.footerTagline;
      changes["search.popular"] = v.popularSearches;
      break;
    }
    case "announcement":
      changes["site.announcement"] = parsed.data as z.infer<typeof forms.announcement>;
      break;
    case "shipping": {
      const v = parsed.data as z.infer<typeof forms.shipping>;
      changes["checkout.shipping"] = { feePaise: v.fee, freeFromPaise: v.freeFrom };
      break;
    }
    case "discount": {
      const v = parsed.data as z.infer<typeof forms.discount>;
      changes["pricing.discount"] = { percent: v.percent };
      break;
    }
    case "payment":
      changes["payment.manual"] = parsed.data as z.infer<typeof forms.payment>;
      break;
    case "seller": {
      const v = parsed.data as z.infer<typeof forms.seller>;
      changes["invoice.seller"] = v;
      break;
    }
    case "switches": {
      const v = parsed.data as z.infer<typeof forms.switches>;
      changes["checkout.enabled"] = { enabled: v.checkout };
      changes["coins.rules"] = { ...current["coins.rules"], enabled: v.coins };
      changes["ebooks.downloads"] = { enabled: v.ebooks };
      changes["site.maintenance"] = { enabled: v.maintenance, message: v.maintenanceMessage };
      break;
    }
  }

  const fieldErrors: Record<string, string> = {};
  for (const key of Object.keys(changes) as SettingKey[]) {
    const result = settingSchemas[key].safeParse(changes[key]);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const property = String(issue.path[0] ?? "");
        fieldErrors[groupField(key, property)] ??= errorFor(key, property);
      }
    }
  }
  return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: true, changes };
}

/** Which form field a setting's failing property belongs to. */
function groupField(key: SettingKey, property: string): string {
  if (key === "invoice.seller") return property === "stateCode" ? "stateCode" : property;
  if (key === "site.maintenance") return "maintenanceMessage";
  return property || "form";
}

function errorFor(key: SettingKey, property: string): string {
  if (key === "payment.manual") {
    if (property === "upiId") return errors.upi;
    if (property === "accountNumber") return errors.account;
    if (property === "ifsc") return errors.ifsc;
  }
  if (key === "invoice.seller") {
    if (property === "stateCode") return errors.state;
    if (property === "pincode") return errors.pincode;
    if (property === "gstin") return errors.gstin;
  }
  return copy.formError;
}

/** JSON with sorted keys: MySQL stores JSON objects with their own key order. */
function comparable(value: unknown): string {
  return JSON.stringify(value, (_, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

/**
 * Saves the values that differ from what's stored now. Returns the keys that
 * changed (empty: nothing to save).
 */
export async function saveSettings(actorId: string, changes: Changes): Promise<SettingKey[]> {
  const keys = Object.keys(changes) as SettingKey[];
  const changed: SettingKey[] = [];
  await db.$transaction(async (tx) => {
    const rows = await tx.setting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });
    const stored = new Map(rows.map((row) => [row.key, row.value]));
    for (const key of keys) {
      // Cast: Prisma's JSON input type doesn't know our value shapes; each
      // was validated against settingSchemas[key] by parseSettingsForm.
      const value = settingSchemas[key].parse(changes[key]) as never;
      const before = stored.has(key) ? stored.get(key) : settingDefaults[key];
      if (comparable(before) === comparable(value)) continue;
      await tx.setting.upsert({
        where: { key },
        create: { key, value, updatedBy: actorId },
        update: { value, updatedBy: actorId },
      });
      await tx.settingHistory.create({ data: { settingKey: key, value, changedBy: actorId } });
      await logAdminAction(tx, {
        actorId,
        action: "setting.update",
        resource: "Setting",
        resourceId: key,
        changes: diffFields(flatten(before), flatten(value)),
      });
      changed.push(key);
    }
  });
  // updateTag (not revalidateTag) so the very next page load shows the change.
  if (changed.length > 0) updateTag(contentTags.settings);
  return changed;
}

/** Top-level properties as strings, so objects and lists show up in the log. */
function flatten(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { value: comparable(value) };
  }
  return Object.fromEntries(
    Object.entries(value).map(([name, v]) => [name, typeof v === "object" && v !== null ? comparable(v) : v]),
  );
}

/** The latest history rows across all settings, newest first. */
export async function readSettingHistory(take = 12) {
  const rows = await db.settingHistory.findMany({
    orderBy: [{ changedAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      settingKey: true,
      changedAt: true,
      changedByUser: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    key: row.settingKey,
    changedAt: row.changedAt,
    by: row.changedByUser?.name ?? null,
  }));
}

/** Everything the settings page shows, read straight through getSetting(). */
export async function readSettingsForAdmin() {
  const [phone, supportNote, popular, tagline, shipping, discount, seller, announcement, checkout, coins, ebooks, maintenance, payment] =
    await Promise.all([
      getSetting("contact.phone"),
      getSetting("contact.supportNote"),
      getSetting("search.popular"),
      getSetting("footer.tagline"),
      getSetting("checkout.shipping"),
      getSetting("pricing.discount"),
      getSetting("invoice.seller"),
      getSetting("site.announcement"),
      getSetting("checkout.enabled"),
      getSetting("coins.rules"),
      getSetting("ebooks.downloads"),
      getSetting("site.maintenance"),
      getSetting("payment.manual"),
    ]);
  return { phone, supportNote, popular, tagline, shipping, discount, seller, announcement, checkout, coins, ebooks, maintenance, payment };
}
