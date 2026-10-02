import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { settingDefaults } from "@/content/settings";
import { db } from "@/server/db";
import { getSetting } from "@/server/content/settings";
import { resetAuthData, userTypeIds } from "../../../tests/setup/auth";
import { clearContentTables } from "../../../tests/setup/content-db";
import { parseSettingsForm, saveSettings } from "./settings";

const adminId = "settings-admin";
const coins = { "coins.rules": settingDefaults["coins.rules"] };

const contactForm = {
  phone: "+91 98765 43210",
  supportNote: "Call us any weekday.",
  footerTagline: "Ayurveda, simply.",
  popularSearches: "Punarnava Mandoor\n\n  Kidney Care  \n",
};

beforeEach(async () => {
  await clearContentTables(db);
  await resetAuthData(db);
  const types = await userTypeIds(db);
  await db.user.create({
    data: {
      id: adminId,
      name: "Settings Admin",
      email: "settings-admin@example.test",
      role: "admin",
      userTypeId: types.customer,
      termsAcceptedAt: new Date(),
    },
  });
});

afterAll(async () => {
  await db.$disconnect();
});

function parsed(group: Parameters<typeof parseSettingsForm>[0], values: Record<string, string>) {
  const result = parseSettingsForm(group, values, coins);
  if (!result.ok) throw new Error(JSON.stringify(result.fieldErrors));
  return result.changes;
}

describe("parseSettingsForm", () => {
  it("turns the contact form into setting values, one search per line", () => {
    expect(parsed("contact", contactForm)).toEqual({
      "contact.phone": "+91 98765 43210",
      "contact.supportNote": "Call us any weekday.",
      "footer.tagline": "Ayurveda, simply.",
      "search.popular": ["Punarnava Mandoor", "Kidney Care"],
    });
  });

  it("rejects a bad phone number and more than eight searches", () => {
    const result = parseSettingsForm(
      "contact",
      { ...contactForm, phone: "98765", popularSearches: "a\nb\nc\nd\ne\nf\ng\nh\ni" },
      coins,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors).sort()).toEqual(["phone", "popularSearches"]);
  });

  it("converts rupees to paise, and a blank free-delivery amount to never", () => {
    expect(parsed("shipping", { fee: "99.50", freeFrom: "" })).toEqual({
      "checkout.shipping": { feePaise: 9950, freeFromPaise: null },
    });
    expect(parseSettingsForm("shipping", { fee: "-5", freeFrom: "" }, coins).ok).toBe(false);
  });

  it("needs text before the announcement bar can be switched on, and a safe link", () => {
    expect(parseSettingsForm("announcement", { enabled: "on", text: "", href: "" }, coins).ok).toBe(false);
    expect(
      parseSettingsForm("announcement", { enabled: "on", text: "Sale", href: "https://evil.example" }, coins).ok,
    ).toBe(false);
    expect(parsed("announcement", { enabled: "on", text: "Sale", href: "/coins" })).toEqual({
      "site.announcement": { enabled: true, text: "Sale", href: "/coins" },
    });
  });

  it("checks the GSTIN against the state", () => {
    const seller = {
      legalName: "Saatvik Vaidya Pvt Ltd",
      addressLines: "1 Test Road",
      city: "Mumbai",
      stateCode: "MH",
      pincode: "400001",
      gstin: "27AAAAA0000A1Z5",
    };
    expect(parseSettingsForm("seller", seller, coins).ok).toBe(true);
    const wrongState = parseSettingsForm("seller", { ...seller, stateCode: "DL" }, coins);
    expect(wrongState.ok).toBe(false);
    if (!wrongState.ok) expect(wrongState.fieldErrors).toHaveProperty("gstin");
  });

  it("the switches keep the other coin rules and turn the coins switch", () => {
    const changes = parsed("switches", { maintenance: "on", maintenanceMessage: "Back soon" });
    expect(changes["site.maintenance"]).toEqual({ enabled: true, message: "Back soon" });
    expect(changes["checkout.enabled"]).toEqual({ enabled: false });
    expect(changes["ebooks.downloads"]).toEqual({ enabled: false });
    expect(changes["coins.rules"]).toEqual({ ...settingDefaults["coins.rules"], enabled: false });
  });
});

describe("saveSettings", () => {
  it("saves the value, history and audit log, and the site reads it", async () => {
    const changed = await saveSettings(adminId, parsed("contact", contactForm));
    expect(changed).toHaveLength(4);
    expect(await getSetting("contact.phone")).toBe("+91 98765 43210");
    expect(await getSetting("search.popular")).toEqual(["Punarnava Mandoor", "Kidney Care"]);

    const row = await db.setting.findUnique({ where: { key: "contact.phone" } });
    expect(row?.updatedBy).toBe(adminId);
    const history = await db.settingHistory.findMany({ where: { settingKey: "contact.phone" } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ changedBy: adminId });
    const log = await db.adminLog.findFirst({ where: { resourceId: "contact.phone" } });
    expect(log).toMatchObject({ action: "setting.update", resource: "Setting", userId: adminId });
  });

  it("writes nothing when nothing changed", async () => {
    await saveSettings(adminId, parsed("contact", contactForm));
    const again = await saveSettings(adminId, parsed("contact", contactForm));
    expect(again).toEqual([]);
    expect(await db.settingHistory.count({ where: { settingKey: "contact.phone" } })).toBe(1);
  });

  it("keeps the history, without the name, when the admin is deleted", async () => {
    await saveSettings(adminId, parsed("contact", contactForm));
    await db.user.delete({ where: { id: adminId } });
    const history = await db.settingHistory.findMany({ where: { settingKey: "contact.phone" } });
    expect(history).toHaveLength(1);
    expect(history[0].changedBy).toBeNull();
  });

  it("refuses a value the site couldn't read back", async () => {
    await expect(saveSettings(adminId, { "contact.phone": "nope" })).rejects.toThrow();
    expect(await db.setting.count()).toBe(0);
  });
});
