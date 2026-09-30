import { describe, expect, it } from "vitest";
import { settingDefaults, type SettingKey } from "@/content/settings";
import { getSetting, resolveSetting, settingSchemas } from "./settings";

const keys = Object.keys(settingDefaults) as SettingKey[];

describe("getSetting", () => {
  it("returns the default for every key", async () => {
    for (const key of keys) {
      expect(await getSetting(key)).toEqual(settingDefaults[key]);
    }
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
