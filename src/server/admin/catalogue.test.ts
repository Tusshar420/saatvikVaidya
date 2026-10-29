import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_PRODUCT_IMAGES } from "@/lib/catalogue";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { getStorage } from "@/server/storage";
import { clearContentTables } from "../../../tests/setup/content-db";
import {
  addProductImage,
  createProduct,
  deleteProductImage,
  moveProductImage,
  parseProductForm,
  productFormValues,
  getAdminProduct,
  updateProduct,
  updateProductImageAlt,
  type ProductInput,
} from "./catalogue";

// Catalogue admin: the product form's rules, saving with an audit trail, and
// product images in Storage (a temporary folder in tests).

const adminId = "catalogue-admin";
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 9]);
const pdf = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");

let ids: { brand: number; form: number; area: number; otherArea: number };

function form(overrides: Record<string, string | undefined> = {}): Record<string, string> {
  const values: Record<string, string | undefined> = {
    name: "Test Ashwagandha Churna",
    slug: "",
    brandId: String(ids.brand),
    formId: String(ids.form),
    [`area-${ids.area}`]: "on",
    packSize: "100 g",
    description: "A test product.\nSecond line.",
    ingredients: "Ashwagandha",
    dosage: "",
    mrp: "1,250.50",
    professionalPrice: "900",
    gstRate: "5",
    hsnCode: "3004",
    moq: "2",
    "tiers.0.minQuantity": "10",
    "tiers.0.price": "850",
    "tiers.1.minQuantity": "",
    "tiers.1.price": "",
    "tiers.2.minQuantity": "50",
    "tiers.2.price": "800.25",
    active: "on",
    sortOrder: "5",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

function parsed(values = form()): ProductInput {
  const result = parseProductForm(values);
  if (!result.success) throw new Error(JSON.stringify(result.fieldErrors));
  return result.data;
}

function errorsOf(values: Record<string, string>) {
  const result = parseProductForm(values);
  return result.success ? {} : result.fieldErrors;
}

beforeEach(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
  const customer = await db.userType.findUniqueOrThrow({ where: { key: "customer" } });
  await db.user.create({
    data: {
      id: adminId,
      name: "Catalogue Admin",
      email: "catalogue-admin@example.test",
      role: "admin",
      userTypeId: customer.id,
      termsAcceptedAt: new Date(),
    },
  });
  const category = (key: string) =>
    db.category.findUniqueOrThrow({ where: { key } }).then((c) => c.id);
  ids = {
    brand: (await db.brand.findUniqueOrThrow({ where: { key: "flowgra" } })).id,
    form: await category("churna"),
    area: await category("joint-care"),
    otherArea: await category("skin-care"),
  };
});

afterAll(async () => {
  await db.$disconnect();
});

describe("parseProductForm", () => {
  it("turns rupees into paise, makes a slug and keeps filled tiers in order", () => {
    expect(parsed()).toMatchObject({
      name: "Test Ashwagandha Churna",
      slug: "test-ashwagandha-churna",
      practiceAreaIds: [ids.area],
      mrpPaise: 125_050,
      professionalPricePaise: 90_000,
      gstRate: 5,
      moq: 2,
      dosage: null,
      active: true,
      featured: false,
      isSample: false,
      bulkTiers: [
        { minQuantity: 10, pricePaise: 85_000 },
        { minQuantity: 50, pricePaise: 80_025 },
      ],
    });
  });

  it("keeps the professional price at or below MRP", () => {
    expect(errorsOf(form({ professionalPrice: "1300" }))).toHaveProperty("professionalPrice");
    expect(errorsOf(form({ mrp: "0" }))).toHaveProperty("mrp");
    expect(errorsOf(form({ mrp: "12.345" }))).toHaveProperty("mrp");
  });

  it("needs each tier to have a larger quantity and a lower price", () => {
    expect(errorsOf(form({ "tiers.0.price": "900" }))).toHaveProperty("tiers.0.price");
    expect(errorsOf(form({ "tiers.2.minQuantity": "10" }))).toHaveProperty(
      "tiers.2.minQuantity",
    );
    expect(errorsOf(form({ "tiers.2.price": "860" }))).toHaveProperty("tiers.2.price");
    expect(errorsOf(form({ "tiers.0.minQuantity": "1" }))).toHaveProperty(
      "tiers.0.minQuantity",
    );
    expect(errorsOf(form({ "tiers.1.minQuantity": "20" }))).toHaveProperty("tiers.1.price");
  });

  it("checks the slug, HSN code, GST rate and whole numbers", () => {
    const errors = errorsOf(
      form({ slug: "Not a slug!", hsnCode: "30a4", gstRate: "7", moq: "1.5" }),
    );
    expect(Object.keys(errors).sort()).toEqual(["gstRate", "hsnCode", "moq", "slug"]);
    expect(errorsOf(form({ name: "", brandId: "", formId: "x" }))).toMatchObject({
      name: expect.any(String),
      brandId: expect.any(String),
      formId: expect.any(String),
    });
  });
});

describe("createProduct / updateProduct", () => {
  it("creates a product with its areas and tiers, and logs it", async () => {
    const result = await createProduct(parsed(), adminId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const product = await getAdminProduct(result.id);
    expect(product?.practiceAreas).toEqual([{ id: ids.area }]);
    expect(product?.bulkTiers.map((t) => t.minQuantity)).toEqual([10, 50]);
    const log = await db.adminLog.findFirstOrThrow({ where: { action: "product.create" } });
    expect(log).toMatchObject({ userId: adminId, resource: "Product", resourceId: String(result.id) });

    // The form's starting values round-trip to the same input.
    const values = productFormValues(product!);
    const again = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === true ? "on" : v === false || v === null ? "" : String(v)]),
    );
    expect(parsed(again)).toEqual(parsed());
  });

  it("refuses a taken slug, an unknown brand, and an area used as a form", async () => {
    expect(await createProduct(parsed(form({ slug: "triphala-churna" })), adminId)).toEqual({
      ok: false,
      fieldErrors: { slug: expect.any(String) },
    });
    const bad = await createProduct(
      parsed(form({ brandId: "999999", formId: String(ids.area) })),
      adminId,
    );
    expect(bad).toEqual({
      ok: false,
      fieldErrors: { brandId: expect.any(String), formId: expect.any(String) },
    });
    // A form used as a practice area.
    const wrongArea = await createProduct(
      parsed(form({ [`area-${ids.form}`]: "on" })),
      adminId,
    );
    expect(wrongArea).toMatchObject({ ok: false, fieldErrors: { practiceAreaIds: expect.any(String) } });
  });

  it("updates prices, areas and tiers, logging only what changed", async () => {
    const created = await createProduct(parsed(), adminId);
    if (!created.ok) throw new Error("create failed");
    const changed = parsed(
      form({
        [`area-${ids.area}`]: undefined,
        [`area-${ids.otherArea}`]: "on",
        professionalPrice: "950",
        "tiers.2.minQuantity": "",
        "tiers.2.price": "",
        active: undefined,
      }),
    );
    expect(await updateProduct(created.id, changed, adminId)).toEqual({ ok: true, id: created.id });
    const product = await getAdminProduct(created.id);
    expect(product).toMatchObject({ professionalPricePaise: 95_000, active: false });
    expect(product?.practiceAreas).toEqual([{ id: ids.otherArea }]);
    expect(product?.bulkTiers.map((t) => t.minQuantity)).toEqual([10]);

    const log = await db.adminLog.findFirstOrThrow({ where: { action: "product.update" } });
    expect(Object.keys(log.changes as object).sort()).toEqual([
      "active",
      "bulkTiers",
      "practiceAreaIds",
      "professionalPricePaise",
    ]);

    // Saving the same values again changes and logs nothing.
    await updateProduct(created.id, changed, adminId);
    expect(await db.adminLog.count({ where: { action: "product.update" } })).toBe(1);
    expect(await updateProduct(999_999, changed, adminId)).toBeNull();
  });
});

describe("product images", () => {
  async function productId() {
    return (await db.product.findUniqueOrThrow({ where: { slug: "triphala-churna" } })).id;
  }

  it("stores checked photos, orders them, renames and deletes them", async () => {
    const id = await productId();
    const first = await addProductImage({ productId: id, bytes: png, alt: "Front", actorId: adminId });
    const second = await addProductImage({ productId: id, bytes: webp, alt: "Back", actorId: adminId });
    if (!first.ok || !second.ok) throw new Error("upload failed");

    const rows = await db.productImage.findMany({
      where: { productId: id },
      orderBy: { sortOrder: "asc" },
    });
    expect(rows.map((r) => [r.id, r.contentType])).toEqual([
      [first.id, "image/png"],
      [second.id, "image/webp"],
    ]);
    expect(rows[0]?.fileKey).toMatch(new RegExp(`^products/${id}/[0-9a-f]{32}\\.png$`));
    expect(await getStorage().get(rows[0]!.fileKey)).not.toBeNull();

    await moveProductImage(second.id, "up", adminId);
    const reordered = await db.productImage.findMany({
      where: { productId: id },
      orderBy: { sortOrder: "asc" },
    });
    expect(reordered.map((r) => r.id)).toEqual([second.id, first.id]);
    // Moving past the end does nothing.
    await moveProductImage(second.id, "up", adminId);

    await updateProductImageAlt(first.id, "Front of the pack", adminId);
    expect((await db.productImage.findUniqueOrThrow({ where: { id: first.id } })).alt).toBe(
      "Front of the pack",
    );

    expect(await deleteProductImage(first.id, adminId)).toEqual({ productId: id });
    expect(await getStorage().get(rows[0]!.fileKey)).toBeNull();
    expect(await deleteProductImage(first.id, adminId)).toBeNull();
    expect(
      await db.adminLog.count({ where: { resource: "Product", resourceId: String(id) } }),
    ).toBe(5);
  });

  it("refuses other file types, missing products and too many photos", async () => {
    const id = await productId();
    const add = (bytes: Uint8Array, productId = id) =>
      addProductImage({ productId, bytes, alt: "Photo", actorId: adminId });
    expect(await add(pdf)).toEqual({ ok: false, error: "fileType" });
    expect(await add(new Uint8Array())).toEqual({ ok: false, error: "empty" });
    expect(await add(png, 999_999)).toEqual({ ok: false, error: "notFound" });

    for (let i = 0; i < MAX_PRODUCT_IMAGES; i += 1) expect((await add(png)).ok).toBe(true);
    expect(await add(png)).toEqual({ ok: false, error: "tooMany" });
    expect(await db.productImage.count({ where: { productId: id } })).toBe(MAX_PRODUCT_IMAGES);
  });
});
