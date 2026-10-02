import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { parseProductForm } from "@/server/admin/catalogue";
import { cancelOrder } from "@/server/admin/orders";
import { createAddress, parseAddress } from "@/server/checkout/addresses";
import { startPaymentAttempt } from "@/server/checkout/orders";
import { completePayment } from "@/server/checkout/payments";
import { db } from "@/server/db";
import type { Message } from "@/server/notify";
import { listOrdersForUser } from "@/server/orders/history";
import { seedDatabase } from "@/server/seed";
import { getStorage } from "@/server/storage";
import { captureMessages } from "../../../tests/setup/auth";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin } from "../../../tests/setup/orders";
import { makeProduct, makeUser, stockOf, validAddress } from "../../../tests/setup/shop";
import {
  chooseBrandProduct,
  draftLogoFile,
  furthestStep,
  listBrandProducts,
  readDraft,
  saveBrandQuantity,
  saveDraftLogo,
  savePackaging,
} from "./drafts";
import { applyBrandImport, parseCsv, previewBrandImport } from "./import";
import {
  brandOrderLogoFile,
  brandTotals,
  listBrandOrdersForUser,
  placeBrandOrder,
  readBrandOrderForUser,
} from "./orders";

// Launch Your Brand (P2.1): drafts step by step, the minimum-step rule on
// the server, brand orders priced from the database and paid through the
// test provider, access to logos, and the admin CSV import.

const shipping = { feePaise: 8_000, freeFromPaise: 99_900 };

/** The first bytes of a PNG: enough for the type check. */
const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3]);
const svg = () => new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

const packaging = {
  brandName: "Vaidya Care",
  tagline: "Rooted in classics",
  marketedByName: "Vaidya Care LLP",
  marketedByAddress: "12 MG Road\nPune 411001",
  contactPhone: "+91 92203 58400",
  notes: "",
};

let sent: Message[];

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
  sent = captureMessages();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

async function withAddress(userId: string) {
  const parsed = parseAddress(validAddress);
  if (!parsed.success) throw new Error("fixture should be valid");
  const address = await createAddress(userId, parsed.data);
  if (!address.ok) throw new Error("address not created");
  return address.id;
}

/** A user with a complete draft for a new product with minimum 4 at ₹260. */
async function readyDraft(options: { quantity?: number; type?: string } = {}) {
  const product = await makeProduct(db, { stock: 3, brand: { minQty: 4, unitPricePaise: 26_000 } });
  const userId = await makeUser(db, { type: options.type ?? "customer" });
  expect(await chooseBrandProduct(userId, product.id)).toBe(true);
  const logo = await saveDraftLogo({ userId, fileName: "logo.png", bytes: png() });
  expect(logo.ok).toBe(true);
  expect(await savePackaging(userId, packaging)).toEqual({ ok: true });
  expect(await saveBrandQuantity(userId, options.quantity ?? 8)).toEqual({ ok: true });
  const addressId = await withAddress(userId);
  return { product, userId, addressId };
}

async function place(
  who: { userId: string; addressId: number },
  quantity = 8,
  overrides: Partial<Parameters<typeof placeBrandOrder>[0]> = {},
) {
  return placeBrandOrder({
    userId: who.userId,
    addressId: who.addressId,
    checkoutKey: randomUUID(),
    expectedTotalPaise: brandTotals({ unitPricePaise: 26_000 }, 5, quantity, shipping).totalPaise,
    shipping,
    ...overrides,
  });
}

async function pay(orderId: string, userId: string, outcome: "succeeded" | "failed" = "succeeded") {
  const attempt = await startPaymentAttempt(orderId);
  if (!attempt) throw new Error("no payment attempt");
  return completePayment({ reference: attempt.reference, outcome }, userId);
}

describe("eligible products", () => {
  it("lists only active products with every brand term, and filters them", async () => {
    const open = await makeProduct(db, { brand: { minQty: 6, unitPricePaise: 15_000 } });
    const hidden = await makeProduct(db, { active: false, brand: { minQty: 6, unitPricePaise: 15_000 } });
    const plain = await makeProduct(db);
    const listing = await listBrandProducts({});
    const ids = listing.products.map((product) => product.id);
    expect(ids).toContain(open.id);
    expect(ids).not.toContain(hidden.id);
    expect(ids).not.toContain(plain.id);
    expect(listing.products.find((product) => product.id === open.id)?.terms).toEqual({
      minQty: 6,
      unitPricePaise: 15_000,
      unitLabel: "bottles",
    });
    // The seeded samples are open too (sample values until the client's sheet).
    expect(listing.products.some((product) => product.slug === "vasavaleha")).toBe(true);
    expect(listing.forms.length).toBeGreaterThan(0);

    const searched = await listBrandProducts({ q: "Vasavaleha" });
    expect(searched.products.map((product) => product.slug)).toEqual(["vasavaleha"]);
    const byForm = await listBrandProducts({ form: "no-such-form" });
    expect(byForm.products).toEqual([]);
  });
});

describe("drafts", () => {
  it("opens each step only after the one before it", async () => {
    const product = await makeProduct(db, { brand: { minQty: 4, unitPricePaise: 26_000 } });
    const plain = await makeProduct(db);
    const userId = await makeUser(db, { type: "doctor", verificationStatus: "pending" });

    expect(furthestStep(await readDraft(userId))).toBe(1);
    expect(await chooseBrandProduct(userId, plain.id)).toBe(false);
    expect(await chooseBrandProduct(userId, product.id)).toBe(true);
    expect(furthestStep(await readDraft(userId))).toBe(2);

    // The label text needs a logo, and checks its limits.
    const noLogo = await savePackaging(userId, packaging);
    expect(noLogo.ok).toBe(false);
    if (!noLogo.ok && "fieldErrors" in noLogo) expect(Object.keys(noLogo.fieldErrors)).toEqual(["logo"]);
    expect(await saveBrandQuantity(userId, 4)).toEqual({ ok: false, error: "packaging" });

    expect(await saveDraftLogo({ userId, fileName: "logo.svg", bytes: svg() })).toEqual({
      ok: false,
      error: "fileType",
    });
    expect((await saveDraftLogo({ userId, fileName: "../../etc/logo.png", bytes: png() })).ok).toBe(true);
    const bad = await savePackaging(userId, {
      ...packaging,
      brandName: " ",
      tagline: "x".repeat(121),
      contactPhone: "12",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok && "fieldErrors" in bad) {
      expect(Object.keys(bad.fieldErrors).sort()).toEqual(["brandName", "contactPhone", "tagline"]);
    }
    expect(await savePackaging(userId, packaging)).toEqual({ ok: true });
    const draft = await readDraft(userId);
    expect(draft?.logo?.name).toBe("logo.png");
    expect(draft?.packaging.marketedByAddress).toBe("12 MG Road\nPune 411001");
    expect(draft?.packaging.notes).toBeNull();
    expect(furthestStep(draft)).toBe(3);

    // The quantity must be a positive multiple of the minimum.
    for (const quantity of [0, 2, 5, 6, 10]) {
      expect(await saveBrandQuantity(userId, quantity)).toEqual({ ok: false, error: "quantity", minQty: 4 });
    }
    expect(await saveBrandQuantity(userId, 12)).toEqual({ ok: true });
    expect(furthestStep(await readDraft(userId))).toBe(4);

    // Another product has another minimum, so the quantity is cleared.
    const other = await makeProduct(db, { brand: { minQty: 5, unitPricePaise: 10_000 } });
    await chooseBrandProduct(userId, other.id);
    expect((await readDraft(userId))?.quantity).toBeNull();
    expect(furthestStep(await readDraft(userId))).toBe(3);

    // A product taken off branding sends the draft back to step 1.
    await db.product.update({ where: { id: other.id }, data: { brandEligible: false } });
    const gone = await readDraft(userId);
    expect(gone?.productGone).toBe(true);
    expect(furthestStep(gone)).toBe(1);
  });

  it("replaces the logo file and removes the old one", async () => {
    const { userId } = await readyDraft();
    const first = await draftLogoFile(userId);
    expect(first?.key).toMatch(/^brand-logos\/.+\.png$/);
    await saveDraftLogo({ userId, fileName: "new.png", bytes: png() });
    const second = await draftLogoFile(userId);
    expect(second?.key).not.toBe(first?.key);
    expect(await getStorage().get(first!.key)).toBeNull();
    expect(await getStorage().get(second!.key)).not.toBeNull();
  });

  it("needs a chosen product before a logo", async () => {
    const userId = await makeUser(db);
    expect(await saveDraftLogo({ userId, fileName: "a.png", bytes: png() })).toEqual({
      ok: false,
      error: "noDraft",
    });
  });
});

describe("placing a brand order", () => {
  it("prices it from the database, keeps the label details and clears the draft", async () => {
    const who = await readyDraft({ quantity: 8 });
    const result = await place(who, 8);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await db.order.findUniqueOrThrow({
      where: { id: result.orderId },
      include: { items: true, brandDetails: true },
    });
    expect(order.type).toBe("brand");
    expect(order.status).toBe("pending_payment");
    expect(order.subtotalPaise).toBe(208_000);
    expect(order.shippingPaise).toBe(0);
    expect(order.totalPaise).toBe(208_000);
    expect(order.taxPaise).toBe(9_905);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ quantity: 8, unitPaise: 26_000, priceTier: "brand" });
    expect(order.brandDetails).toMatchObject({
      brandName: "Vaidya Care",
      contactPhone: "+91 92203 58400",
      logoContentType: "image/png",
    });
    expect(await readDraft(who.userId)).toBeNull();
    // Its logo now belongs to the order.
    expect(await getStorage().get(order.brandDetails!.logoKey)).not.toBeNull();
  });

  it("refuses a total that no longer matches, and a draft that isn't finished", async () => {
    const who = await readyDraft();
    expect(await place(who, 8, { expectedTotalPaise: 1 })).toEqual({ ok: false, error: "changed" });
    // The brand price changed after the page was shown.
    await db.product.update({ where: { id: who.product.id }, data: { brandUnitPricePaise: 27_000 } });
    expect(await place(who, 8)).toEqual({ ok: false, error: "changed" });

    const userId = await makeUser(db);
    const addressId = await withAddress(userId);
    expect(await place({ userId, addressId })).toEqual({ ok: false, error: "draft" });
  });

  it("re-checks the quantity step on the server", async () => {
    const who = await readyDraft();
    // A tampered draft (not a multiple of the minimum) can't become an order.
    await db.brandDraft.update({ where: { userId: who.userId }, data: { quantity: 6 } });
    expect(await place(who, 6)).toEqual({ ok: false, error: "changed" });
  });

  it("places one order for a double submit", async () => {
    const who = await readyDraft();
    const checkoutKey = randomUUID();
    const [a, b] = await Promise.all([place(who, 8, { checkoutKey }), place(who, 8, { checkoutKey })]);
    expect(a).toEqual(b);
    expect(await db.order.count({ where: { userId: who.userId } })).toBe(1);
  });

  it("refuses someone else's address", async () => {
    const who = await readyDraft();
    const other = await makeUser(db);
    const otherAddress = await withAddress(other);
    expect(await place({ userId: who.userId, addressId: otherAddress })).toEqual({
      ok: false,
      error: "address",
    });
  });
});

describe("paying for a brand order", () => {
  it("is paid once, takes no stock, earns no coins and tells the buyer and order admins", async () => {
    const who = await readyDraft();
    const ordersAdmin = await makeAdmin(db);
    await db.user.update({ where: { id: ordersAdmin }, data: { adminRole: "orders" } });
    const contentAdmin = await makeAdmin(db);
    await db.user.update({ where: { id: contentAdmin }, data: { adminRole: "content" } });
    const placed = await place(who);
    if (!placed.ok) throw new Error("not placed");

    const outcome = await pay(placed.orderId, who.userId);
    expect(outcome).toMatchObject({ status: "paid", type: "brand", changed: true });
    // Made to order: stock 3 is far below 8 and stays as it was.
    expect(await stockOf(db, who.product.id)).toBe(3);
    expect(await db.coinLedger.count({ where: { userId: who.userId } })).toBe(0);
    expect(await db.invoice.count({ where: { orderId: placed.orderId } })).toBe(1);

    const buyerEmail = (await db.user.findUniqueOrThrow({ where: { id: who.userId } })).email;
    const adminEmails = await db.user.findMany({
      where: { id: { in: [ordersAdmin, contentAdmin] } },
      select: { id: true, email: true },
    });
    const to = sent.map((message) => message.to);
    expect(to).toContain(buyerEmail);
    expect(to).toContain(adminEmails.find((row) => row.id === ordersAdmin)!.email);
    expect(to).not.toContain(adminEmails.find((row) => row.id === contentAdmin)!.email);
    const adminMessage = sent.find(
      (message) => message.channel === "email" && message.subject.includes("Vaidya Care"),
    );
    expect(adminMessage?.channel === "email" && adminMessage.text).toContain(`/admin/brand-orders/${placed.orderId}`);

    // Cancelling a paid brand order puts no stock back (it never took any).
    const cancelled = await cancelOrder(ordersAdmin, placed.orderId);
    expect(cancelled).toMatchObject({ ok: true, restocked: false });
    expect(await stockOf(db, who.product.id)).toBe(3);
  });

  it("can fail and be paid on a retry", async () => {
    const who = await readyDraft();
    const placed = await place(who);
    if (!placed.ok) throw new Error("not placed");
    expect(await pay(placed.orderId, who.userId, "failed")).toMatchObject({ status: "payment_failed" });
    await db.order.update({ where: { id: placed.orderId }, data: { status: "pending_payment" } });
    expect(await pay(placed.orderId, who.userId)).toMatchObject({ status: "paid" });
  });
});

describe("reading brand orders", () => {
  it("shows them on My Brand only, to their owner (and the logo to admins)", async () => {
    const who = await readyDraft();
    const placed = await place(who);
    if (!placed.ok) throw new Error("not placed");
    const stranger = await makeUser(db);

    expect((await listBrandOrdersForUser(who.userId)).map((order) => order.id)).toEqual([placed.orderId]);
    expect((await listOrdersForUser(who.userId)).orders).toEqual([]);
    const view = await readBrandOrderForUser(who.userId, placed.orderId);
    expect(view).toMatchObject({ brandName: "Vaidya Care", quantity: 8, unitLabel: "bottles" });
    expect(await readBrandOrderForUser(stranger, placed.orderId)).toBeNull();

    expect(await brandOrderLogoFile(placed.orderId, { userId: who.userId, isAdmin: false })).not.toBeNull();
    expect(await brandOrderLogoFile(placed.orderId, { userId: stranger, isAdmin: false })).toBeNull();
    expect(await brandOrderLogoFile(placed.orderId, { userId: stranger, isAdmin: true })).not.toBeNull();
    expect(await brandOrderLogoFile("not-an-order-id", { userId: stranger, isAdmin: true })).toBeNull();
  });
});

describe("admin catalogue form", () => {
  const base = {
    name: "Brand form product",
    brandId: "1",
    formId: "1",
    packSize: "60 tablets",
    description: "Text",
    mrp: "320",
    professionalPrice: "240",
    gstRate: "5",
    hsnCode: "3004",
    stock: "10",
    moq: "1",
    sortOrder: "0",
  };

  it("needs all three terms to open a product for branding", () => {
    const parsed = parseProductForm({ ...base, brandEligible: "on", brandMinQty: "4" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.fieldErrors.brandEligible).toBeDefined();
  });

  it("checks each term", () => {
    const parsed = parseProductForm({ ...base, brandMinQty: "0", brandUnitPrice: "-1" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.fieldErrors.brandMinQty).toBeDefined();
      expect(parsed.fieldErrors.brandUnitPrice).toBeDefined();
    }
  });
});

describe("CSV import", () => {
  it("parses quoted fields, commas and line endings", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n\nlast,')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["last", ""],
    ]);
  });

  it("previews every row with its match or error, and applies only a clean file", async () => {
    const one = await makeProduct(db);
    const two = await makeProduct(db);
    const name = (await db.product.findUniqueOrThrow({ where: { id: two.id } })).name;
    const admin = await makeAdmin(db);

    const messy = [
      "Product,Minimum,Price,Unit",
      `${one.slug},4,260,jars`,
      `"${name}",12,"1,200.50",bottles`,
      "no-such-product,4,100,jars",
      `${one.slug},4,100,jars`,
      `${two.slug},0,100,jars`,
      `${two.slug},4,0,jars`,
      `${two.slug},4,100,`,
      `${two.slug},4,100`,
    ].join("\n");
    const preview = await previewBrandImport(messy);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.valid).toBe(2);
    expect(preview.rows.map((row) => row.error === null)).toEqual([
      true, true, false, false, false, false, false, false,
    ]);
    expect(preview.rows[1]?.values).toEqual({ minQty: 12, unitPricePaise: 120_050, unitLabel: "bottles" });
    expect(preview.rows[3]?.line).toBe(5);
    expect(preview.rows[3]?.error).toMatch(/earlier row/);

    // Any error blocks the whole file.
    const blocked = await applyBrandImport(messy, admin);
    expect(blocked.ok).toBe(false);
    expect((await db.product.findUniqueOrThrow({ where: { id: one.id } })).brandEligible).toBe(false);

    const clean = ["product,minimum,price,unit", `${one.slug},4,260,jars`, `"${name}",12,1200.50,bottles`].join("\n");
    expect(await applyBrandImport(clean, admin)).toEqual({ ok: true, updated: 2 });
    expect(await db.product.findUniqueOrThrow({ where: { id: one.id } })).toMatchObject({
      brandEligible: true,
      brandMinQty: 4,
      brandUnitPricePaise: 26_000,
      brandUnitLabel: "jars",
    });
    expect(
      await db.adminLog.count({ where: { action: "product.brand_import", userId: admin } }),
    ).toBe(2);
    // The same file again changes nothing.
    expect(await applyBrandImport(clean, admin)).toEqual({ ok: true, updated: 0 });
  });

  it("refuses files without the headings, empty files and huge files", async () => {
    expect(await previewBrandImport("name,min\nx,1")).toMatchObject({ ok: false });
    expect(await previewBrandImport("product,minimum,price,unit\n")).toMatchObject({ ok: false });
    expect(await previewBrandImport("")).toMatchObject({ ok: false });
    expect(await previewBrandImport(`product,minimum,price,unit\n${"x,1,1,a\n".repeat(30_000)}`)).toMatchObject({
      ok: false,
    });
  });
});
