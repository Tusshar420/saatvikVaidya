import "server-only";
import { z } from "zod";
import {
  settingDefaults,
  type SettingKey,
  type SettingValues,
} from "@/content/settings";
import { db } from "@/server/db";
import { cachedRead, contentTags } from "./cache";

/**
 * What a stored value must look like for each key. Anything else (missing,
 * wrong shape, empty) falls back to the default in src/content/settings.ts.
 */
export const settingSchemas = {
  "contact.phone": z.string().regex(/^\+91 [6-9]\d{4} \d{5}$/),
  "contact.supportNote": z.string().trim().min(1).max(300),
  "search.popular": z.array(z.string().trim().min(1).max(60)).min(1).max(8),
  "footer.tagline": z.string().trim().min(1).max(200),
} satisfies { [K in SettingKey]: z.ZodType<SettingValues[K]> };

const settingKeys = Object.keys(settingDefaults) as SettingKey[];

/** A stored value if it's valid for `key`, otherwise the default. */
export function resolveSetting<K extends SettingKey>(
  key: K,
  stored: unknown,
): SettingValues[K] {
  if (stored === undefined || stored === null) return settingDefaults[key];
  const parsed = settingSchemas[key].safeParse(stored);
  // The cast is safe: settingSchemas[K] parses to SettingValues[K] (checked by
  // `satisfies` above), but TypeScript can't follow the generic index.
  return parsed.success
    ? (parsed.data as SettingValues[K])
    : settingDefaults[key];
}

/** Stored values for every known setting key, straight from the database. */
export async function readStoredSettings(): Promise<
  Partial<Record<SettingKey, unknown>>
> {
  const rows = await db.setting.findMany({
    where: { key: { in: settingKeys } },
    select: { key: true, value: true },
  });
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

// One cached read for all settings: a page usually needs several of them.
const cachedStoredSettings = cachedRead(
  readStoredSettings,
  "settings:all",
  contentTags.settings,
);

/**
 * Reads one site setting from the Setting table (cached). A missing or
 * invalid value falls back to its default, and so does every key if the
 * database can't be reached, so the site shell always renders.
 */
export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<SettingValues[K]> {
  let stored: Partial<Record<SettingKey, unknown>>;
  try {
    stored = await cachedStoredSettings();
  } catch (error) {
    console.error("getSetting: settings unavailable, using defaults.", error);
    stored = {};
  }
  return resolveSetting(key, stored[key]);
}
