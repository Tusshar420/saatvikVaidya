import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAddress, parseAddress } from "@/server/checkout/addresses";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { labelSpecSeed } from "@/server/seed/label-specs";
import { getStorage } from "@/server/storage";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeProduct, makeUser, validAddress } from "../../../tests/setup/shop";
import { addToBrandCart, brandCartTotals, readBrandCart, setBrandCartQuantity } from "./cart";
import { readDraft, savePackaging } from "./drafts";
import { parseLabelSnapshot, readLabelLines, toLabelSpec } from "./labels";
import { placeBrandOrder, readBrandOrderForUser } from "./orders";
import {
  chooseProfile,
  chosenProfile,
  createProfile,
  deleteProfile,
  listProfiles,
  profileLogoFile,
  readProfile,
  saveProfileLogo,
  setDefaultProfile,
  updateProfile,
} from "./profiles";
import { MAX_BRAND_PROFILES } from "@/lib/label";

// Saved brand profiles and per-product label details: profiles scoped to
// their owner, defaults fitted to each product's label spec, per-line
// overrides that never change the profile, limits that stop the packaging
// step, and the label saved with the order.

const shipping = { feePaise: 8_000, freeFromPaise: 99_900 };
const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3]);

const values = {
  profileName: "Main brand",
  brandName: "Vaidya Care",
  tagline: "Rooted in classics",
  shortDescription: "Classical Ayurveda, made simple.",
  longDescription: "Classical Ayurvedic formulations made to traditional recipes, tested and packed with care.",
  marketedByName: "Vaidya Care LLP",
  marketedByAddress: "12 MG Road\nPune 411001",
  contactPhone: "+91 92203 58400",
  licenceNumbers: "Lic. No. AYU/2024/118",
  primaryColour: "#1F6F5C",
  secondaryColour: "",
};

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
});

// Some tests change a spec: put the seeded limits back.
afterEach(async () => {
  for (const spec of labelSpecSeed) {
    await db.labelSpec.update({ where: { key: spec.key }, data: { limits: spec.limits } });
  }
});

afterAll(async () => {
  await db.$disconnect();
});

async function brandWithLogo(userId: string, extra: Record<string, string> = {}) {
  const created = await createProfile(userId, { ...values, ...extra });
  if (!created.ok) throw new Error(JSON.stringify(created));
  expect((await saveProfileLogo({ userId, profileId: created.id, fileName: "logo.png", bytes: png() })).ok).toBe(true);
  return created.id;
}

async function specId(key: string) {
  return (await db.labelSpec.findUniqueOrThrow({ where: { key } })).id;
}

describe("saved brand profiles", () => {
  it("saves, lists, edits and validates a brand", async () => {
    const userId = await makeUser(db);
    const bad = await createProfile(userId, {
      ...values,
      brandName: " ",
      profileName: "",
      shortDescription: "line\nbreak",
      contactPhone: "12",
      primaryColour: "green",
    });
    expect(bad).toMatchObject({ ok: false, error: "invalid" });
    if (!bad.ok && bad.error === "invalid") {
      expect(Object.keys(bad.fieldErrors).sort()).toEqual([
        "brandName",
        "contactPhone",
        "primaryColour",
        "profileName",
        "shortDescription",
      ]);
    }
    expect(await listProfiles(userId)).toEqual([]);

    const id = await brandWithLogo(userId);
    const [profile] = await listProfiles(userId);
    expect(profile).toMatchObject({
      id,
      isDefault: true,
      brandName: "Vaidya Care",
      primaryColour: "#1f6f5c",
      secondaryColour: null,
      licenceNumbers: "Lic. No. AYU/2024/118",
    });
    expect(profile?.logo?.name).toBe("logo.png");

    expect(await updateProfile(userId, id, { ...values, tagline: "", licenceNumbers: "" })).toEqual({ ok: true, id });
    expect(await readProfile(userId, id)).toMatchObject({ tagline: null, licenceNumbers: null });
  });

  it("keeps one default, hands it on when it is deleted, and removes the logo file", async () => {
    const userId = await makeUser(db);
    const first = await brandWithLogo(userId, { profileName: "First" });
    const second = await brandWithLogo(userId, { profileName: "Second" });
    const third = await createProfile(userId, { ...values, profileName: "Third" }, { makeDefault: true });
    expect((await listProfiles(userId)).map((p) => [p.profileName, p.isDefault])).toEqual([
      ["Third", true],
      ["First", false],
      ["Second", false],
    ]);
    expect(await setDefaultProfile(userId, second)).toBe(true);
    expect((await listProfiles(userId))[0]).toMatchObject({ id: second, isDefault: true });
    expect((await listProfiles(userId)).filter((p) => p.isDefault)).toHaveLength(1);

    const logoKey = (await profileLogoFile(userId, second))!.key;
    expect(await deleteProfile(userId, second)).toBe(true);
    expect(await getStorage().get(logoKey)).toBeNull();
    // The oldest remaining brand is the default now.
    const rest = await listProfiles(userId);
    expect(rest.map((p) => [p.id, p.isDefault])).toEqual([
      [first, true],
      [third.ok ? third.id : 0, false],
    ]);
    expect(await deleteProfile(userId, second)).toBe(false);
  });

  it("never shows, changes or deletes another user's brand", async () => {
    const owner = await makeUser(db);
    const stranger = await makeUser(db);
    const id = await brandWithLogo(owner);
    expect(await readProfile(stranger, id)).toBeNull();
    expect(await updateProfile(stranger, id, values)).toEqual({ ok: false, error: "not_found" });
    expect(await setDefaultProfile(stranger, id)).toBe(false);
    expect(await chooseProfile(stranger, id)).toBe(false);
    expect(await deleteProfile(stranger, id)).toBe(false);
    expect(await listProfiles(stranger)).toEqual([]);
    expect(await readProfile(owner, id)).not.toBeNull();
  });

  it("limits how many brands one account keeps", async () => {
    const userId = await makeUser(db);
    for (let n = 0; n < MAX_BRAND_PROFILES; n += 1) {
      expect((await createProfile(userId, { ...values, profileName: `Brand ${n}` })).ok).toBe(true);
    }
    expect(await createProfile(userId, values)).toEqual({ ok: false, error: "too_many" });
  });

  it("uses the chosen brand, else the default", async () => {
    const userId = await makeUser(db);
    const first = await brandWithLogo(userId, { profileName: "First" });
    const second = await brandWithLogo(userId, { profileName: "Second" });
    let profiles = await listProfiles(userId);
    expect(chosenProfile(profiles, null)?.id).toBe(first);
    const product = await makeProduct(db, { brand: { minQty: 4, unitPricePaise: 26_000 } });
    await addToBrandCart(userId, product.id);
    expect(await chooseProfile(userId, second)).toBe(true);
    profiles = await listProfiles(userId);
    expect(chosenProfile(profiles, await readDraft(userId))?.id).toBe(second);
    // Deleting the chosen brand falls back to the default.
    await deleteProfile(userId, second);
    profiles = await listProfiles(userId);
    expect(chosenProfile(profiles, await readDraft(userId))?.id).toBe(first);
  });
});

describe("label specs", () => {
  it("seeds specs for the pack types and falls back to the general spec", async () => {
    const rows = await db.labelSpec.findMany({ orderBy: { sortOrder: "asc" } });
    expect(rows.map((row) => row.key)).toEqual(["tube", "bottle", "jar", "pouch"]);
    const tube = toLabelSpec(rows[0]!);
    expect(tube).toMatchObject({ widthMm: 90, heightMm: 40, descriptionSource: "short" });
    expect(tube.logo.placement).toBe("top-left");
    expect(tube.limits.ingredients).toBeUndefined();
    expect(toLabelSpec(null).key).toBe("general");
    // A spec with unreadable limits doesn't break a page.
    expect(toLabelSpec({ ...rows[0]!, limits: { nonsense: 1 } }).key).toBe("general");
  });
});

describe("label details of a cart line", () => {
  async function twoProducts() {
    const userId = await makeUser(db);
    const tube = await makeProduct(db, { brand: { minQty: 4, unitPricePaise: 26_000 } });
    const bottle = await makeProduct(db, { brand: { minQty: 6, unitPricePaise: 18_000 } });
    await db.product.update({ where: { id: tube.id }, data: { labelSpecId: await specId("tube") } });
    await db.product.update({
      where: { id: bottle.id },
      data: { labelSpecId: await specId("bottle"), ingredients: "Haritaki, Amalaki", dosage: "1 tsp twice a day." },
    });
    await addToBrandCart(userId, tube.id);
    await addToBrandCart(userId, bottle.id);
    const profileId = await brandWithLogo(userId);
    return { userId, tube, bottle, profileId };
  }

  it("starts each line from the brand, fitted to its pack", async () => {
    const { userId, tube, bottle, profileId } = await twoProducts();
    const profile = (await readProfile(userId, profileId))!;
    const [tubeLine, bottleLine] = await readLabelLines(userId, profile);
    expect(tubeLine?.productId).toBe(tube.id);
    expect(tubeLine?.values.description).toBe("Classical Ayurveda, made simple.");
    expect(tubeLine?.values.ingredients).toBeUndefined();
    expect(bottleLine?.productId).toBe(bottle.id);
    expect(bottleLine?.values.description).toBe(values.longDescription);
    expect(bottleLine?.values.ingredients).toBe("Haritaki, Amalaki");
    expect(bottleLine?.values.usage).toBe("1 tsp twice a day.");
    expect(tubeLine?.problems).toEqual([]);
  });

  it("keeps a product's changes without touching the brand, and follows the brand for the rest", async () => {
    const { userId, tube, bottle, profileId } = await twoProducts();
    const profile = (await readProfile(userId, profileId))!;
    expect(
      await savePackaging(userId, {
        labels: new Map([[tube.id, { tagline: "Tube only line", brandName: "Vaidya Care" }]]),
      }),
    ).toEqual({ ok: true });
    const stored = await db.brandCartItem.findMany({ where: { userId }, orderBy: { id: "asc" } });
    // Only the changed field is kept, and only on that product.
    expect(stored[0]?.labelOverrides).toEqual({ tagline: "Tube only line" });
    expect(stored[1]?.labelOverrides).toBeNull();
    expect((await readProfile(userId, profileId))?.tagline).toBe("Rooted in classics");

    const [tubeLine, bottleLine] = await readLabelLines(userId, profile);
    expect(tubeLine?.values.tagline).toBe("Tube only line");
    expect(tubeLine?.overrides).toEqual({ tagline: "Tube only line" });
    expect(bottleLine?.values.tagline).toBe("Rooted in classics");

    // Changing the brand later reaches the lines that weren't overridden.
    await updateProfile(userId, profileId, { ...values, brandName: "Vaidya Care Plus", tagline: "Changed" });
    const changed = (await readProfile(userId, profileId))!;
    const [afterTube, afterBottle] = await readLabelLines(userId, changed);
    expect(afterTube?.values).toMatchObject({ brandName: "Vaidya Care Plus", tagline: "Tube only line" });
    expect(afterBottle?.values).toMatchObject({ brandName: "Vaidya Care Plus", tagline: "Changed" });
    expect(bottle.id).toBe(afterBottle?.productId);

    // Typing the default back removes the override.
    await savePackaging(userId, { labels: new Map([[tube.id, { tagline: "Changed" }]]) });
    expect((await db.brandCartItem.findFirstOrThrow({ where: { userId, productId: tube.id } })).labelOverrides).toBeNull();
  });

  it("blocks the step while text is too long for a pack, and saves what was typed", async () => {
    const { userId, tube } = await twoProducts();
    const result = await savePackaging(userId, {
      labels: new Map([[tube.id, { description: "x".repeat(91), brandName: "" }]]),
    });
    expect(result.ok).toBe(false);
    if (result.ok || !("labelProblems" in result)) throw new Error("expected label problems");
    expect(result.labelProblems.get(tube.id)).toEqual([
      { field: "brandName", length: 0, limit: 40 },
      { field: "description", length: 91, limit: 90 },
    ]);
    // Nothing is confirmed, and the typed text is kept.
    expect((await readDraft(userId))?.packagingDone).toBe(false);
    expect((await db.brandCartItem.findFirstOrThrow({ where: { userId, productId: tube.id } })).labelOverrides).toEqual({
      description: "x".repeat(91),
      brandName: "",
    });
    // Fixed: confirmed.
    expect(
      await savePackaging(userId, { labels: new Map([[tube.id, { description: "Short", brandName: "VC" }]]) }),
    ).toEqual({ ok: true });
  });

  it("ignores fields a pack doesn't print and products that aren't in the cart", async () => {
    const { userId, tube } = await twoProducts();
    await savePackaging(userId, {
      labels: new Map([
        [tube.id, { ingredients: "not printed on a tube", tagline: "Kept" }],
        [999_999, { tagline: "nobody's" }],
      ]),
    });
    const line = await db.brandCartItem.findFirstOrThrow({ where: { userId, productId: tube.id } });
    expect(line.labelOverrides).toEqual({ tagline: "Kept" });
  });

  it("saves the label as approved with the order, and the order keeps it when the brand changes or goes", async () => {
    const { userId, tube, bottle, profileId } = await twoProducts();
    await savePackaging(userId, {
      notes: "",
      labels: new Map([[bottle.id, { usage: "Two spoons at night." }]]),
    });
    await setBrandCartQuantity(userId, tube.id, 4);
    await setBrandCartQuantity(userId, bottle.id, 6);
    const parsed = parseAddress(validAddress);
    if (!parsed.success) throw new Error("fixture should be valid");
    const address = await createAddress(userId, parsed.data);
    if (!address.ok) throw new Error("address");
    const total = brandCartTotals(await readBrandCart(userId), shipping).totalPaise;
    const placed = await placeBrandOrder({
      userId,
      addressId: address.id,
      checkoutKey: randomUUID(),
      expectedTotalPaise: total,
      shipping,
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    const check = async () => {
      const view = await readBrandOrderForUser(userId, placed.orderId);
      const [tubeItem, bottleItem] = view!.items;
      expect(tubeItem?.label?.spec).toMatchObject({ key: "tube", widthMm: 90, heightMm: 40 });
      expect(tubeItem?.label?.values.description).toBe("Classical Ayurveda, made simple.");
      expect(tubeItem?.label?.overridden).toEqual([]);
      expect(bottleItem?.label?.spec.key).toBe("bottle");
      expect(bottleItem?.label?.values.usage).toBe("Two spoons at night.");
      expect(bottleItem?.label?.values.ingredients).toBe("Haritaki, Amalaki");
      expect(bottleItem?.label?.overridden).toEqual(["usage"]);
      expect(view?.details).toMatchObject({ brandName: "Vaidya Care", licenceNumbers: "Lic. No. AYU/2024/118" });
    };
    await check();
    // The brand and the products change, then the brand is deleted: the order is as approved.
    await updateProfile(userId, profileId, { ...values, brandName: "Other", longDescription: "New text" });
    await db.product.update({ where: { id: bottle.id }, data: { ingredients: "Different" } });
    await db.labelSpec.update({ where: { key: "bottle" }, data: { limits: { brandName: 5 } } });
    await deleteProfile(userId, profileId);
    await check();
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: placed.orderId, productId: bottle.id } });
    expect(parseLabelSnapshot(item.labelDetails)?.spec.limits.description).toBe(250);
    // The brand profile is kept after an order (for the next one), unless deleted.
    expect(await db.brandProfile.count({ where: { userId } })).toBe(0);
  });

  it("refuses an order whose label no longer fits (a limit tightened after confirming)", async () => {
    const { userId, tube } = await twoProducts();
    const typed = "A tagline of about forty-five characters here";
    expect(await savePackaging(userId, { notes: "", labels: new Map([[tube.id, { tagline: typed }]]) })).toEqual({
      ok: true,
    });
    await db.labelSpec.update({ where: { key: "tube" }, data: { limits: { brandName: 40, tagline: 20 } } });
    const parsed = parseAddress(validAddress);
    if (!parsed.success) throw new Error("fixture should be valid");
    const address = await createAddress(userId, parsed.data);
    if (!address.ok) throw new Error("address");
    const total = brandCartTotals(await readBrandCart(userId), shipping).totalPaise;
    const placed = await placeBrandOrder({
      userId,
      addressId: address.id,
      checkoutKey: randomUUID(),
      expectedTotalPaise: total,
      shipping,
    });
    expect(placed).toEqual({ ok: false, error: "draft" });
    expect(await db.order.count({ where: { userId } })).toBe(0);
  });
});
