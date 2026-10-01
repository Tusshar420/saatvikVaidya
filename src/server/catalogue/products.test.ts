import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { guestViewer, type PricingViewer } from "@/server/pricing/rules";
import { seedDatabase } from "@/server/seed";
import { productSeed } from "@/server/seed/catalogue";
import { clearContentTables } from "../../../tests/setup/content-db";
import {
  catalogueFiltersSchema,
  findServableProductImage,
  listCatalogue,
  readProductPage,
} from "./products";

// The public catalogue against the seeded sample products.

const doctor: PricingViewer = { kind: "professional", professional: true, bulk: false };
const pharmacy: PricingViewer = { kind: "professional", professional: true, bulk: true };

const filters = (params: Record<string, string> = {}) =>
  catalogueFiltersSchema.parse(params);

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("catalogueFiltersSchema", () => {
  it("drops bad values instead of failing", () => {
    expect(
      filters({ q: "  ", form: "<script>", sort: "cheapest", page: "-3" }),
    ).toEqual({
      q: undefined,
      form: undefined,
      area: undefined,
      brand: undefined,
      sort: "featured",
      page: 1,
    });
    expect(filters({ q: " triphala ", form: "Churna", page: "2" })).toMatchObject({
      q: "triphala",
      form: "churna",
      page: 2,
    });
  });
});

describe("listCatalogue", () => {
  it("lists every active sample product, featured first, 12 a page", async () => {
    const listing = await listCatalogue(filters(), guestViewer);
    expect(listing.total).toBe(productSeed.length);
    expect(listing.products).toHaveLength(12);
    expect(listing.pageCount).toBe(1);
    expect(listing.products.slice(0, 3).map((p) => p.slug)).toEqual([
      "punarnava-mandoor",
      "triphala-churna",
      "chyawanprash",
    ]);
    expect(listing.products.every((p) => p.isSample)).toBe(true);
    expect(listing.facets.forms).toHaveLength(6);
    expect(listing.facets.areas).toHaveLength(7);
    expect(listing.facets.brands.map((b) => b.key)).toEqual([
      "sabka-vaidya",
      "pranacharya",
      "flowgra",
    ]);
  });

  it("filters by form, practice area and brand together", async () => {
    const byForm = await listCatalogue(filters({ form: "churna" }), guestViewer);
    expect(byForm.products.map((p) => p.slug).sort()).toEqual([
      "avipattikar-churna",
      "triphala-churna",
    ]);
    const combined = await listCatalogue(
      filters({ area: "joint-care", brand: "flowgra" }),
      guestViewer,
    );
    expect(combined.products.map((p) => p.slug).sort()).toEqual([
      "kaishore-guggulu",
      "mahanarayan-taila",
    ]);
  });

  it("ignores filter keys that don't exist", async () => {
    const listing = await listCatalogue(filters({ brand: "no-such-brand" }), guestViewer);
    expect(listing.filters.brand).toBeUndefined();
    expect(listing.total).toBe(productSeed.length);
  });

  it("searches names, brands, forms, areas and ingredients; every word must match", async () => {
    const search = async (q: string) =>
      (await listCatalogue(filters({ q }), guestViewer)).products.map((p) => p.slug).sort();
    expect(await search("punarnava")).toEqual(["punarnava-mandoor"]);
    expect(await search("ashwagandha")).toEqual(["chyawanprash", "mahanarayan-taila"]);
    expect(await search("flowgra joint")).toEqual(["kaishore-guggulu", "mahanarayan-taila"]);
    expect(await search("arishta")).toEqual(["ashokarishta", "dashmoolarishta"]);
    expect(await search("unobtainium")).toEqual([]);
  });

  it("sorts by the price the viewer pays", async () => {
    const cheapest = async (viewer: PricingViewer) =>
      (await listCatalogue(filters({ sort: "price-asc" }), viewer)).products[0];
    expect((await cheapest(guestViewer))?.price).toEqual({
      unitPaise: 15_000,
      mrpPaise: 15_000,
      tier: "mrp",
    });
    expect((await cheapest(doctor))?.price).toEqual({
      unitPaise: 11_000,
      mrpPaise: 15_000,
      tier: "professional",
    });
    const prices = (await listCatalogue(filters({ sort: "price-desc" }), doctor)).products.map(
      (p) => p.price.unitPaise,
    );
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  it("leaves out hidden products and shows a page past the end as the last", async () => {
    await db.product.update({ where: { slug: "vasavaleha" }, data: { active: false } });
    try {
      const listing = await listCatalogue(filters({ page: "9" }), guestViewer);
      expect(listing.page).toBe(1);
      expect(listing.products.map((p) => p.slug)).not.toContain("vasavaleha");
      expect(await readProductPage("vasavaleha", guestViewer)).toBeNull();
    } finally {
      await db.product.update({ where: { slug: "vasavaleha" }, data: { active: true } });
    }
  });

  it("marks products that can't be ordered as out of stock", async () => {
    const listing = await listCatalogue(filters({ q: "kaishore" }), guestViewer);
    expect(listing.products[0]?.inStock).toBe(false);
  });
});

describe("readProductPage", () => {
  it("shows a guest MRP and holds no professional prices", async () => {
    const page = await readProductPage("punarnava-mandoor", guestViewer);
    expect(page).toMatchObject({
      name: "Punarnava Mandoor",
      brand: { key: "sabka-vaidya", name: "Sabka Vaidya" },
      form: { key: "vati-gutika" },
      practiceAreas: [{ key: "kidney-care", name: "Kidney care" }],
      gstRate: 5,
      stock: { kind: "in" },
      isSample: true,
      viewer: "guest",
      price: { unitPaise: 32_000, tier: "mrp", bulkTiers: [] },
    });
    // Nothing on the page object reveals the professional or bulk prices.
    const json = JSON.stringify(page);
    expect(json).not.toContain("24000");
    expect(json).not.toContain("22500");
    expect(json).not.toContain("professionalPricePaise");
  });

  it("shows tiers only to viewers with bulk prices", async () => {
    const forDoctor = await readProductPage("punarnava-mandoor", doctor);
    expect(forDoctor?.price).toMatchObject({ unitPaise: 24_000, bulkTiers: [] });
    const forPharmacy = await readProductPage("punarnava-mandoor", pharmacy);
    expect(forPharmacy?.price.bulkTiers).toEqual([
      { minQuantity: 10, pricePaise: 22_500 },
      { minQuantity: 50, pricePaise: 21_000 },
    ]);
  });

  it("reports low stock, and returns null for unknown or malformed slugs", async () => {
    expect((await readProductPage("arogyavardhini-vati", guestViewer))?.stock).toEqual({
      kind: "low",
      left: 8,
    });
    expect(await readProductPage("no-such-product", guestViewer)).toBeNull();
    expect(await readProductPage("../etc/passwd", guestViewer)).toBeNull();
  });
});

describe("findServableProductImage", () => {
  it("serves active products' images to anyone and hidden ones to admins only", async () => {
    const product = await db.product.findUniqueOrThrow({ where: { slug: "ashokarishta" } });
    const image = await db.productImage.create({
      data: {
        productId: product.id,
        fileKey: "products/test/0123456789abcdef0123456789abcdef.png",
        contentType: "image/png",
        sizeBytes: 10,
        alt: "Pack front",
      },
    });
    expect(await findServableProductImage(image.id, false)).toMatchObject({ public: true });
    await db.product.update({ where: { id: product.id }, data: { active: false } });
    try {
      expect(await findServableProductImage(image.id, false)).toBeNull();
      expect(await findServableProductImage(image.id, true)).toMatchObject({ public: false });
    } finally {
      await db.product.update({ where: { id: product.id }, data: { active: true } });
      await db.productImage.delete({ where: { id: image.id } });
    }
  });
});
