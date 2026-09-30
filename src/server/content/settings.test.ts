import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { settingDefaults, type SettingKey } from "@/content/settings";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { clearContentTables } from "../../../tests/setup/content-db";
import { contentRevalidateSeconds, contentTags } from "./cache";
import { getSetting, resolveSetting, settingSchemas } from "./settings";

// Next's data cache only exists inside a Next server; here each read goes
// straight to the test database. The wrapper's options are still checked.
const { cacheCalls } = vi.hoisted(() => ({ cacheCalls: [] as unknown[][] }));
vi.mock("next/cache", () => ({
  unstable_cache: (read: () => Promise<unknown>, ...options: unknown[]) => {
    cacheCalls.push(options);
    return read;
  },
}));

const keys = Object.keys(settingDefaults) as SettingKey[];

beforeEach(async () => {
  await clearContentTables(db);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("getSetting", () => {
  it("is a cached read tagged for settings", () => {
    expect(cacheCalls).toContainEqual([
      ["settings:all"],
      { tags: [contentTags.settings], revalidate: contentRevalidateSeconds },
    ]);
  });

  it("returns the default for every key when nothing is stored", async () => {
    for (const key of keys) {
      expect(await getSetting(key)).toEqual(settingDefaults[key]);
    }
  });

  it("reads stored values from the database", async () => {
    await seedDatabase(db);
    await db.setting.update({
      where: { key: "contact.phone" },
      data: { value: "+91 98765 43210" },
    });
    await db.setting.update({
      where: { key: "search.popular" },
      data: { value: ["Chyawanprash"] },
    });

    expect(await getSetting("contact.phone")).toBe("+91 98765 43210");
    expect(await getSetting("search.popular")).toEqual(["Chyawanprash"]);
    expect(await getSetting("footer.tagline")).toBe(
      settingDefaults["footer.tagline"],
    );
  });

  it("falls back per key when a stored value is invalid or missing", async () => {
    await db.setting.create({
      data: { key: "contact.phone", value: "9220358400" },
    });
    await db.setting.create({
      data: { key: "footer.tagline", value: "Stored tagline" },
    });

    expect(await getSetting("contact.phone")).toBe(
      settingDefaults["contact.phone"],
    );
    expect(await getSetting("footer.tagline")).toBe("Stored tagline");
    expect(await getSetting("contact.supportNote")).toBe(
      settingDefaults["contact.supportNote"],
    );
  });

  it("falls back to defaults when the database can't be read", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const read = vi
      .spyOn(db.setting, "findMany")
      .mockRejectedValue(new Error("connection refused"));

    expect(await getSetting("contact.phone")).toBe(
      settingDefaults["contact.phone"],
    );
    expect(read).toHaveBeenCalled();
    expect(log).toHaveBeenCalled();

    read.mockRestore();
    log.mockRestore();
  });

  it("has defaults that pass their own schema", () => {
    for (const key of keys) {
      expect(settingSchemas[key].safeParse(settingDefaults[key]).success).toBe(
        true,
      );
    }
  });
});

describe("resolveSetting", () => {
  it("uses a valid stored value", () => {
    expect(resolveSetting("contact.phone", "+91 98765 43210")).toBe(
      "+91 98765 43210",
    );
    expect(resolveSetting("search.popular", ["Chyawanprash"])).toEqual([
      "Chyawanprash",
    ]);
  });

  it("falls back to the default when nothing is stored", () => {
    expect(resolveSetting("footer.tagline", undefined)).toBe(
      settingDefaults["footer.tagline"],
    );
    expect(resolveSetting("footer.tagline", null)).toBe(
      settingDefaults["footer.tagline"],
    );
  });

  it("falls back to the default when the stored value is invalid", () => {
    expect(resolveSetting("contact.phone", "9220358400")).toBe(
      settingDefaults["contact.phone"],
    );
    expect(resolveSetting("contact.supportNote", "   ")).toBe(
      settingDefaults["contact.supportNote"],
    );
    expect(resolveSetting("search.popular", "Punarnava Mandoor")).toEqual(
      settingDefaults["search.popular"],
    );
    expect(resolveSetting("search.popular", [])).toEqual(
      settingDefaults["search.popular"],
    );
    expect(resolveSetting("footer.tagline", 42)).toBe(
      settingDefaults["footer.tagline"],
    );
  });
});
