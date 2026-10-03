import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { parseProductForm } from "@/server/admin/catalogue";
import { cancelOrder } from "@/server/admin/orders";
import { createAddress, parseAddress } from "@/server/checkout/addresses";
import { startPaymentAttempt } from "@/server/checkout/orders";
import { completePayment } from "@/server/checkout/payments";
import { computeTotals } from "@/server/checkout/totals";
import { db } from "@/server/db";
import type { Message } from "@/server/notify";
import { listOrdersForUser } from "@/server/orders/history";
import { seedDatabase } from "@/server/seed";
import { getStorage } from "@/server/storage";
import { captureMessages } from "../../../tests/setup/auth";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin } from "../../../tests/setup/orders";
import { makeProduct, makeUser, stockOf, validAddress } from "../../../tests/setup/shop";
import { MAX_BRAND_CART_LINES } from "@/lib/brand";
import {
  addToBrandCart,
  brandCartTotals,
  furthestStep,
  readBrandCart,
  removeFromBrandCart,
  setBrandCartQuantity,
} from "./cart";
import { listBrandProducts, readDraft, savePackaging } from "./drafts";
import { applyBrandImport, parseCsv, previewBrandImport } from "./import";
import { chosenProfile, createProfile, listProfiles, profileLogoFile, saveProfileLogo } from "./profiles";
import {
  brandOrderLogoFile,
  listBrandOrdersForUser,
  placeBrandOrder,
  readBrandOrderForUser,
} from "./orders";

// Launch Your Brand (P2.1) with the Launch cart: products and quantities in
// the cart (the minimum-step rule and bulk tiers on the server), the
// packaging draft, brand orders priced from the database and paid through
// the test provider, access to logos, and the admin CSV import.

const shipping = { feePaise: 8_000, freeFromPaise: 99_900 };

/** The first bytes of a PNG: enough for the type check. */
const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3]);
const svg = () => new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

const profileValues = {
  profileName: "Main brand",
  brandName: "Vaidya Care",
  tagline: "Rooted in classics",
  shortDescription: "Classical Ayurveda, made simple.",
  longDescription: "Classical Ayurvedic formulations made to traditional recipes, tested and packed with care.",
  marketedByName: "Vaidya Care LLP",
  marketedByAddress: "12 MG Road\nPune 411001",
  contactPhone: "+91 92203 58400",
  licenceNumbers: "Lic. No. AYU/2024/118",
  primaryColour: "#1f6f5c",
  secondaryColour: "",
};

/** A saved brand with a logo for the user; it becomes their default. */
async function saveBrand(userId: string, values: Record<string, string> = {}) {
  const created = await createProfile(userId, { ...profileValues, ...values });
  if (!created.ok) throw new Error(`brand not saved: ${JSON.stringify(created)}`);
  const logo = await saveProfileLogo({ userId, profileId: created.id, fileName: "logo.png", bytes: png() });
  expect(logo.ok).toBe(true);
  return created.id;
}

/** The furthest step with the user's current draft and chosen brand. */
async function stepOf(userId: string) {
  const [cart, draft, profiles] = await Promise.all([readBrandCart(userId), readDraft(userId), listProfiles(userId)]);
  return furthestStep(cart, draft, chosenProfile(profiles, draft));
}

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

/** A user with a ready Launch cart (a new product, minimum 4 at ₹260) and packaging. */
async function readyDraft(options: { quantity?: number; type?: string } = {}) {
  const product = await makeProduct(db, { stock: 3, brand: { minQty: 4, unitPricePaise: 26_000 } });
  const userId = await makeUser(db, { type: options.type ?? "customer" });
  expect(await addToBrandCart(userId, product.id)).toMatchObject({ ok: true, quantity: 4 });
  await saveBrand(userId);
  expect(await savePackaging(userId, { notes: "" })).toEqual({ ok: true });
  expect(await setBrandCartQuantity(userId, product.id, options.quantity ?? 8)).toMatchObject({ ok: true });
  const addressId = await withAddress(userId);
  return { product, userId, addressId };
}

/** The total the review page shows for `quantity` of the ₹260 product. */
const totalFor = (quantity: number) =>
  computeTotals([{ lineTotalPaise: 26_000 * quantity, gstRate: 5 }], shipping).totalPaise;

async function place(
  who: { userId: string; addressId: number },
  quantity = 8,
  overrides: Partial<Parameters<typeof placeBrandOrder>[0]> = {},
) {
  return placeBrandOrder({
    userId: who.userId,
    addressId: who.addressId,
    checkoutKey: randomUUID(),
    expectedTotalPaise: totalFor(quantity),
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
      tiers: [],
    });
    // The seeded samples are open too (sample values until the client's sheet).
    expect(listing.products.some((product) => product.slug === "vasavaleha")).toBe(true);
    expect(listing.forms.length).toBeGreaterThan(0);

    const searched = await listBrandProducts({ q: "Vasavaleha" });
    expect(searched.products.map((product) => product.slug)).toEqual(["vasavaleha"]);
    const byForm = await listBrandProducts({ form: "no-such-form" });
    // An unknown form is dropped, like the store listing, rather than emptying the list.
    expect(byForm.filters.form).toBeUndefined();
    expect(byForm.total).toBe(byForm.totalEligible);
  });

  it("filters by branded price, sorts and pages", async () => {
    const cheap = await makeProduct(db, { brand: { minQty: 6, unitPricePaise: 11_100 } });
    const dear = await makeProduct(db, { brand: { minQty: 6, unitPricePaise: 99_900 } });
    const all = await listBrandProducts({});
    expect(all.priceRange.min).toBeLessThanOrEqual(111);
    expect(all.priceRange.max).toBeGreaterThanOrEqual(999);

    const mid = await listBrandProducts({ minPrice: 112, maxPrice: 998 });
    const ids = mid.products.map((product) => product.id);
    expect(ids).not.toContain(cheap.id);
    expect(ids).not.toContain(dear.id);
    // ₹999.00 is inside "up to ₹999"; a flipped range is put right.
    const top = await listBrandProducts({ minPrice: 999, maxPrice: 111, sort: "price-desc" });
    expect(top.filters.minPrice).toBe(111);
    expect(top.filters.maxPrice).toBe(999);
    expect(top.products.map((product) => product.id)).toContain(dear.id);
    const prices = top.products.map((product) => product.terms.unitPricePaise);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));

    // The ends of the range mean no limit; a page past the end shows the last.
    const ends = await listBrandProducts({ minPrice: all.priceRange.min, maxPrice: all.priceRange.max });
    expect(ends.total).toBe(all.total);
    const far = await listBrandProducts({ page: 999 });
    expect(far.page).toBe(far.pageCount);
  });
});

describe("the Launch cart", () => {
  it("adds products at their minimum, steps them by it, and opens each step in turn", async () => {
    const product = await makeProduct(db, { brand: { minQty: 4, unitPricePaise: 26_000 } });
    const other = await makeProduct(db, { gstRate: 12, brand: { minQty: 5, unitPricePaise: 10_000 } });
    const plain = await makeProduct(db);
    const userId = await makeUser(db, { type: "doctor", verificationStatus: "pending" });

    expect((await stepOf(userId))).toBe(1);
    expect(await addToBrandCart(userId, plain.id)).toEqual({ ok: false, error: { kind: "unavailable" } });
    expect(await addToBrandCart(userId, product.id)).toEqual({ ok: true, quantity: 4, count: 1 });
    // Adding it again adds one more step of the minimum.
    expect(await addToBrandCart(userId, product.id)).toEqual({ ok: true, quantity: 8, count: 1 });
    expect(await addToBrandCart(userId, other.id)).toEqual({ ok: true, quantity: 5, count: 2 });

    const cart = await readBrandCart(userId);
    expect(cart.lines.map((line) => [line.productId, line.quantity, line.lineTotalPaise])).toEqual([
      [product.id, 8, 208_000],
      [other.id, 5, 50_000],
    ]);
    expect(cart).toMatchObject({ units: 13, subtotalPaise: 258_000, ready: true });
    // Two GST rates, each in the totals.
    expect(brandCartTotals(cart, shipping).gst.map((group) => group.rate)).toEqual([5, 12]);
    expect((await stepOf(userId))).toBe(3);

    // Quantities must be positive multiples of the minimum.
    for (const quantity of [0, 2, 5, 6, 10]) {
      expect(await setBrandCartQuantity(userId, product.id, quantity)).toEqual({
        ok: false,
        error: { kind: "quantity", minQty: 4 },
      });
    }
    expect(await setBrandCartQuantity(userId, product.id, 12)).toMatchObject({ ok: true, quantity: 12 });
    expect(await setBrandCartQuantity(userId, plain.id, 4)).toEqual({ ok: false, error: { kind: "not_in_cart" } });

    // Packaging, then the review step opens.
    await saveBrand(userId);
    expect(await savePackaging(userId, { notes: "" })).toEqual({ ok: true });
    expect((await stepOf(userId))).toBe(4);

    // A product taken off branding stays in the cart, unpriced, and blocks checkout.
    await db.product.update({ where: { id: other.id }, data: { brandEligible: false } });
    const gone = await readBrandCart(userId);
    expect(gone.lines[1]).toMatchObject({ product: null, valid: false, lineTotalPaise: 0 });
    expect(gone.ready).toBe(false);
    expect((await stepOf(userId))).toBe(2);
    expect(await removeFromBrandCart(userId, other.id)).toEqual({ count: 1 });
    expect((await readBrandCart(userId)).ready).toBe(true);
    // A changed minimum makes the line invalid until it is fixed.
    await db.product.update({ where: { id: product.id }, data: { brandMinQty: 5 } });
    expect((await readBrandCart(userId)).lines[0]?.valid).toBe(false);
    expect(await addToBrandCart(userId, product.id)).toMatchObject({ ok: true, quantity: 20 });

    expect(await removeFromBrandCart(userId, product.id)).toEqual({ count: 0 });
    expect((await stepOf(userId))).toBe(1);
  });

  it("prices each line at the bulk tier its quantity reaches", async () => {
    const product = await makeProduct(db, {
      brand: {
        minQty: 10,
        unitPricePaise: 10_000,
        tiers: [
          { minQuantity: 50, pricePaise: 9_000 },
          { minQuantity: 100, pricePaise: 8_000 },
        ],
      },
    });
    const userId = await makeUser(db);
    await addToBrandCart(userId, product.id);
    const priced = async () => (await readBrandCart(userId)).lines[0]!;
    expect(await priced()).toMatchObject({ quantity: 10, unitPricePaise: 10_000, lineTotalPaise: 100_000 });
    await setBrandCartQuantity(userId, product.id, 50);
    expect(await priced()).toMatchObject({ unitPricePaise: 9_000, lineTotalPaise: 450_000 });
    await setBrandCartQuantity(userId, product.id, 120);
    expect(await priced()).toMatchObject({ unitPricePaise: 8_000, lineTotalPaise: 960_000 });
    expect((await priced()).product?.terms.tiers).toHaveLength(2);
  });

  it("keeps a cart within its product count and the online value limit", async () => {
    const userId = await makeUser(db);
    const products = await Promise.all(
      Array.from({ length: MAX_BRAND_CART_LINES + 1 }, () =>
        makeProduct(db, { brand: { minQty: 1, unitPricePaise: 100 } }),
      ),
    );
    await db.brandCartItem.createMany({
      data: products.slice(0, MAX_BRAND_CART_LINES).map((product) => ({ userId, productId: product.id, quantity: 1 })),
    });
    expect(await addToBrandCart(userId, products.at(-1)!.id)).toEqual({
      ok: false,
      error: { kind: "too_many_lines", max: MAX_BRAND_CART_LINES },
    });
    // A line already in the cart can still grow.
    expect(await addToBrandCart(userId, products[0]!.id)).toMatchObject({ ok: true, quantity: 2 });

    // ₹1,00,000 a unit: 100 units is the ₹1 crore limit, so nothing more fits.
    const dear = await makeProduct(db, { brand: { minQty: 1, unitPricePaise: 10_000_000 } });
    const dearer = await makeProduct(db, { brand: { minQty: 1, unitPricePaise: 10_000_000 } });
    const buyer = await makeUser(db);
    await addToBrandCart(buyer, dear.id);
    expect(await setBrandCartQuantity(buyer, dear.id, 100)).toMatchObject({ ok: true });
    expect(await addToBrandCart(buyer, dearer.id)).toEqual({ ok: false, error: { kind: "too_large" } });
    expect(await addToBrandCart(buyer, dear.id)).toMatchObject({ ok: false });
  });

  it("keeps each user's cart to themselves", async () => {
    const product = await makeProduct(db, { brand: { minQty: 4, unitPricePaise: 26_000 } });
    const owner = await makeUser(db);
    const stranger = await makeUser(db);
    await addToBrandCart(owner, product.id);
    expect((await readBrandCart(stranger)).lines).toEqual([]);
    expect(await setBrandCartQuantity(stranger, product.id, 8)).toEqual({ ok: false, error: { kind: "not_in_cart" } });
    await removeFromBrandCart(stranger, product.id);
    expect((await readBrandCart(owner)).lines).toHaveLength(1);
  });
});

describe("drafts", () => {
  it("confirms the packaging only with a product, a brand and a logo", async () => {
    const product = await makeProduct(db, { brand: { minQty: 4, unitPricePaise: 26_000 } });
    const userId = await makeUser(db);
    expect(await savePackaging(userId, { notes: "" })).toEqual({ ok: false, noProduct: true });
    await addToBrandCart(userId, product.id);
    expect(await savePackaging(userId, { notes: "" })).toEqual({ ok: false, noProfile: true });

    const created = await createProfile(userId, profileValues);
    expect(created.ok).toBe(true);
    expect(await savePackaging(userId, { notes: "" })).toEqual({ ok: false, noLogo: true });

    if (!created.ok) return;
    expect(await saveProfileLogo({ userId, profileId: created.id, fileName: "logo.svg", bytes: svg() })).toEqual({
      ok: false,
      error: "fileType",
    });
    expect(
      (await saveProfileLogo({ userId, profileId: created.id, fileName: "../../etc/logo.png", bytes: png() })).ok,
    ).toBe(true);
    expect(await savePackaging(userId, { notes: "x".repeat(1001) })).toMatchObject({ ok: false, notesError: expect.any(String) });
    expect(await savePackaging(userId, { notes: "Use the green." })).toEqual({ ok: true });
    const draft = await readDraft(userId);
    expect(draft).toMatchObject({ packagingDone: true, notes: "Use the green." });
    const [profile] = await listProfiles(userId);
    expect(profile?.logo?.name).toBe("logo.png");
    expect(profile?.marketedByAddress).toBe("12 MG Road\nPune 411001");
  });

  it("replaces a brand's logo file and removes the old one", async () => {
    const { userId } = await readyDraft();
    const [profile] = await listProfiles(userId);
    const first = await profileLogoFile(userId, profile!.id);
    expect(first?.key).toMatch(/^brand-logos\/.+\.png$/);
    await saveProfileLogo({ userId, profileId: profile!.id, fileName: "new.png", bytes: png() });
    const second = await profileLogoFile(userId, profile!.id);
    expect(second?.key).not.toBe(first?.key);
    expect(await getStorage().get(first!.key)).toBeNull();
    expect(await getStorage().get(second!.key)).not.toBeNull();
    // Changing the logo means the labels are confirmed again.
    expect((await readDraft(userId))?.packagingDone).toBe(false);
  });

  it("only takes a logo for the user's own brand", async () => {
    const owner = await makeUser(db);
    const stranger = await makeUser(db);
    const id = await saveBrand(owner);
    expect(await saveProfileLogo({ userId: stranger, profileId: id, fileName: "a.png", bytes: png() })).toEqual({
      ok: false,
      error: "noProfile",
    });
    expect(await profileLogoFile(stranger, id)).toBeNull();
    expect(await profileLogoFile(owner, id)).not.toBeNull();
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
    expect(await db.brandCartItem.count({ where: { userId: who.userId } })).toBe(0);
    expect(order.brandDetails).toMatchObject({
      brandName: "Vaidya Care",
      contactPhone: "+91 92203 58400",
      logoContentType: "image/png",
    });
    expect(await readDraft(who.userId)).toBeNull();
    // The order has its own copy of the logo, so the brand can change or go.
    const [profile] = await listProfiles(who.userId);
    expect(order.brandDetails!.logoKey).not.toBe((await profileLogoFile(who.userId, profile!.id))?.key);
    expect(await getStorage().get(order.brandDetails!.logoKey)).not.toBeNull();
    expect(order.brandDetails).toMatchObject({
      licenceNumbers: "Lic. No. AYU/2024/118",
      shortDescription: "Classical Ayurveda, made simple.",
      primaryColour: "#1f6f5c",
      secondaryColour: null,
    });
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
    // A tampered cart line (not a multiple of the minimum) can't become an order.
    await db.brandCartItem.updateMany({ where: { userId: who.userId }, data: { quantity: 6 } });
    expect(await place(who, 6)).toEqual({ ok: false, error: "changed" });
  });

  it("orders the whole cart as one brand order, each line at its bulk price", async () => {
    const who = await readyDraft({ quantity: 8 });
    const bulk = await makeProduct(db, {
      gstRate: 12,
      brand: { minQty: 10, unitPricePaise: 10_000, tiers: [{ minQuantity: 50, pricePaise: 9_000 }] },
    });
    await addToBrandCart(who.userId, bulk.id);
    await setBrandCartQuantity(who.userId, bulk.id, 60);
    const expected = computeTotals(
      [
        { lineTotalPaise: 208_000, gstRate: 5 },
        { lineTotalPaise: 540_000, gstRate: 12 },
      ],
      shipping,
    );
    // The total the page showed before the second product was added is refused.
    expect(await place(who, 8)).toEqual({ ok: false, error: "changed" });
    const result = await place(who, 8, { expectedTotalPaise: expected.totalPaise });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await db.order.findUniqueOrThrow({
      where: { id: result.orderId },
      include: { items: { orderBy: { id: "asc" } } },
    });
    expect(order).toMatchObject({ type: "brand", subtotalPaise: 748_000, taxPaise: expected.taxPaise });
    expect(order.items.map((item) => [item.productId, item.quantity, item.unitPaise, item.lineTotalPaise])).toEqual([
      [who.product.id, 8, 26_000, 208_000],
      [bulk.id, 60, 9_000, 540_000],
    ]);
    expect((await readBrandCart(who.userId)).lines).toEqual([]);
    expect(await readDraft(who.userId)).toBeNull();

    const view = await readBrandOrderForUser(who.userId, result.orderId);
    expect(view?.items.map((item) => item.productName)).toHaveLength(2);
    expect(view?.gst.map((group) => group.rate)).toEqual([5, 12]);
    expect((await listBrandOrdersForUser(who.userId))[0]?.items).toHaveLength(2);
  });

  it("refuses a cart with a product that is no longer available", async () => {
    const who = await readyDraft();
    await db.product.update({ where: { id: who.product.id }, data: { active: false } });
    expect(await place(who, 8)).toEqual({ ok: false, error: "changed" });
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
    expect(view).toMatchObject({ brandName: "Vaidya Care" });
    expect(view?.items).toMatchObject([{ quantity: 8, unitLabel: "bottles", unitPaise: 26_000 }]);
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

  it("checks bulk tiers against the brand minimum and price", () => {
    const terms = { ...base, brandEligible: "on", brandMinQty: "10", brandUnitPrice: "100", brandUnitLabel: "packs" };
    const good = parseProductForm({
      ...terms,
      "brandTiers.0.minQuantity": "50",
      "brandTiers.0.price": "90",
      "brandTiers.1.minQuantity": "100",
      "brandTiers.1.price": "80.50",
    });
    expect(good.success).toBe(true);
    if (good.success) {
      expect(good.data.brandTiers).toEqual([
        { minQuantity: 50, pricePaise: 9_000 },
        { minQuantity: 100, pricePaise: 8_050 },
      ]);
    }
    const bad = parseProductForm({
      ...terms,
      "brandTiers.0.minQuantity": "10",
      "brandTiers.0.price": "90",
      "brandTiers.1.minQuantity": "50",
      "brandTiers.1.price": "100",
      "brandTiers.2.minQuantity": "60",
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.fieldErrors["brandTiers.0.minQuantity"]).toBeDefined();
      expect(bad.fieldErrors["brandTiers.1.price"]).toBeDefined();
      expect(bad.fieldErrors["brandTiers.2.price"]).toBeDefined();
    }
    const noTerms = parseProductForm({ ...base, "brandTiers.0.minQuantity": "50", "brandTiers.0.price": "90" });
    expect(noTerms.success).toBe(false);
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
