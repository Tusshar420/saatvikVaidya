import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { getStorage } from "@/server/storage";
import type { PhotoSet } from "@/server/seed/product-photos";
import { clearContentTables } from "../../../tests/setup/content-db";
import { labelPhotoStatus, loadLabelPhotos, updateLabelPhotos } from "./label-photos";

// "Load label photos": variants and photos from the client's label files,
// written to Storage (a temporary folder in tests). Uses its own small photo
// list and folder so it doesn't depend on the committed photos.

const adminId = "label-photos-admin";
const jpeg = (n: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, n, 1, 2, 3]);

const sets: PhotoSet[] = [
  {
    products: ["Test Label Arishta"],
    photos: [
      { file: "Arishta_TEST 1.jpg", name: "Purple" },
      { file: "Arishta_TEST 2.jpg", name: "Royal Blue" },
    ],
  },
  { products: ["Test Label Vati"], photos: [{ file: "GUGGULU_TEST 1.jpg", name: "Green band" }] },
];

let folder: string;
let formId: number;

async function product(name: string, extra: { isSample?: boolean } = {}) {
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
  return db.product.create({
    data: {
      slug,
      name,
      formId,
      description: "Test.",
      packSize: "450 ml",
      mrpPaise: 20000,
      professionalPricePaise: 12000,
      gstRate: 12,
      hsnCode: "3004",
      brandEligible: true,
      ...extra,
    },
    select: { id: true },
  });
}

beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), "label-photos-"));
  await writeFile(join(folder, "arishta-test-1.jpg"), jpeg(1));
  await writeFile(join(folder, "arishta-test-2.jpg"), jpeg(2));
  await writeFile(join(folder, "guggulu-test-1.jpg"), jpeg(3));
});

beforeEach(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
  const customer = await db.userType.findUniqueOrThrow({ where: { key: "customer" } });
  await db.user.create({
    data: {
      id: adminId,
      name: "Label Photos Admin",
      email: "label-photos-admin@example.test",
      role: "admin",
      userTypeId: customer.id,
      termsAcceptedAt: new Date(),
    },
  });
  formId = (await db.category.findUniqueOrThrow({ where: { key: "churna" } })).id;
});

afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
  await db.$disconnect();
});

describe("loadLabelPhotos", () => {
  it("gives every pack size its colour variants, a shop photo and variant photos", async () => {
    const big = await product("Test Label Arishta");
    const small = await product("Test Label Arishta");
    expect(await labelPhotoStatus({ sets, folder })).toEqual({ products: 2, photos: 6, outdated: 0 });

    const result = await loadLabelPhotos(adminId, { sets, folder });
    expect(result).toEqual({ ok: true, products: 2, photos: 6 });

    for (const { id } of [big, small]) {
      const variants = await db.productVariant.findMany({
        where: { productId: id },
        orderBy: { sortOrder: "asc" },
        select: { key: true, name: true, style: true },
      });
      expect(variants).toEqual([
        { key: "purple", name: "Purple", style: "royal-maroon" },
        { key: "royal-blue", name: "Royal Blue", style: "minimal-white" },
      ]);
      const images = await db.productImage.findMany({
        where: { productId: id },
        orderBy: { sortOrder: "asc" },
        select: { variant: true, alt: true, fileKey: true, contentType: true },
      });
      expect(images.map((image) => image.variant)).toEqual([null, "purple", "royal-blue"]);
      expect(images[0]).toMatchObject({ alt: "Test Label Arishta label, Purple", contentType: "image/jpeg" });
      const stored = await getStorage().get(images[2].fileKey);
      expect(stored?.size).toBe(jpeg(2).byteLength);
    }
    expect(
      await db.adminLog.count({ where: { action: "product.label_photos", userId: adminId } }),
    ).toBe(2);
  });

  it("leaves products with photos or variants, and samples, alone; a second press does nothing", async () => {
    const own = await product("Test Label Arishta");
    await db.productVariant.create({
      data: { productId: own.id, key: "mine", name: "Mine", style: "classic-green" },
    });
    await product("Test Label Vati", { isSample: true });
    const vati = await product("Test Label Vati");

    expect(await loadLabelPhotos(adminId, { sets, folder })).toEqual({ ok: true, products: 1, photos: 2 });
    expect(await db.productVariant.findMany({ where: { productId: own.id }, select: { key: true } })).toEqual([
      { key: "mine" },
    ]);
    expect(await db.productImage.count({ where: { productId: own.id } })).toBe(0);
    expect(await db.productImage.count({ where: { productId: vati.id } })).toBe(2);

    expect(await labelPhotoStatus({ sets, folder })).toEqual({ products: 0, photos: 0, outdated: 0 });
    expect(await loadLabelPhotos(adminId, { sets, folder })).toEqual({ ok: true, products: 0, photos: 0 });
  });

  it("changes nothing when a photo file is missing", async () => {
    const { id } = await product("Test Label Arishta");
    const broken: PhotoSet[] = [
      { products: ["Test Label Arishta"], photos: [{ file: "Arishta_GONE 1.jpg", name: "Red" }] },
    ];
    expect(await loadLabelPhotos(adminId, { sets: broken, folder })).toEqual({
      ok: false,
      error: "missing",
      file: "arishta-gone-1.jpg",
    });
    expect(await db.productVariant.count({ where: { productId: id } })).toBe(0);
    expect(await db.productImage.count({ where: { productId: id } })).toBe(0);
  });

  it("replaces older copies with new photo rows, leaving changed products alone", async () => {
    const old = await mkdtemp(join(tmpdir(), "label-photos-old-"));
    await writeFile(join(old, "arishta-test-1.jpg"), new Uint8Array([...jpeg(1), 9, 9, 9]));
    await writeFile(join(old, "arishta-test-2.jpg"), new Uint8Array([...jpeg(2), 9, 9, 9]));
    const first = await product("Test Label Arishta");
    const edited = await product("Test Label Arishta");
    expect(await loadLabelPhotos(adminId, { sets, folder: old })).toMatchObject({ ok: true, products: 2 });
    // An admin changed one photo's description on the second product.
    const touched = await db.productImage.findFirstOrThrow({ where: { productId: edited.id, variant: "purple" } });
    await db.productImage.update({ where: { id: touched.id }, data: { alt: "My own description" } });
    const before = await db.productImage.findMany({ where: { productId: first.id }, select: { id: true, fileKey: true } });

    expect(await labelPhotoStatus({ sets, folder })).toEqual({ products: 0, photos: 0, outdated: 1 });
    expect(await updateLabelPhotos(adminId, { sets, folder })).toEqual({ ok: true, products: 1, photos: 3 });

    const after = await db.productImage.findMany({
      where: { productId: first.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, variant: true, sizeBytes: true },
    });
    expect(after.map((image) => image.variant)).toEqual([null, "purple", "royal-blue"]);
    expect(after.map((image) => image.sizeBytes)).toEqual([8, 8, 8]);
    expect(after.some((image) => before.some((old) => old.id === image.id))).toBe(false);
    expect(await getStorage().get(before[0].fileKey)).toBeNull();
    expect(await db.productVariant.count({ where: { productId: first.id } })).toBe(2);
    expect(await db.productImage.count({ where: { productId: edited.id, sizeBytes: 11 } })).toBe(3);

    expect(await labelPhotoStatus({ sets, folder })).toEqual({ products: 0, photos: 0, outdated: 0 });
    await rm(old, { recursive: true, force: true });
  });
});
