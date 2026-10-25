import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cancelOrder } from "@/server/admin/orders";
import {
  createEbook,
  parseEbookForm,
  setSiteDownloads,
  updateEbook,
  uploadEbookFile,
} from "@/server/admin/ebooks";
import { rateLimitRules } from "@/server/auth/policy";
import { addEbookToCart, addToCart, readCart, type CartOwner } from "@/server/cart/cart";
import { mergeGuestCart } from "@/server/cart/merge";
import { createAddress, parseAddress } from "@/server/checkout/addresses";
import { placeOrder, startPaymentAttempt } from "@/server/checkout/orders";
import { completePayment } from "@/server/checkout/payments";
import { createShipment } from "@/server/shipping/shipments";
import { db } from "@/server/db";
import { issueInvoice } from "@/server/invoices/invoices";
import type { PricingViewer } from "@/server/pricing/rules";
import { seedDatabase } from "@/server/seed";
import { getStorage } from "@/server/storage";
import { captureMessages } from "../../../tests/setup/auth";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin } from "../../../tests/setup/orders";
import { makeProduct, makeUser, stockOf, validAddress } from "../../../tests/setup/shop";
import {
  ebookAccess,
  getEbookBySlug,
  listEbooks,
  listOwnedEbooks,
  openEbookDownload,
  type AccessFacts,
} from "./ebooks";

// Ebooks (P1.8): who may download (guest, free, paid non-buyer, buyer,
// switches off), buying through the normal cart and test payment, and the
// admin side.

const shipping = { feePaise: 8_000, freeFromPaise: 99_900 };
const customer: PricingViewer = { kind: "customer", professional: false, bulk: false };
const pdf = new TextEncoder().encode("%PDF-1.4\n% test ebook\n%%EOF\n");

let adminId: string;
let counter = 0;

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
  await db.ebook.deleteMany();
  await db.setting.update({ where: { key: "ebooks.downloads" }, data: { value: { enabled: true } } });
  captureMessages();
  adminId = await makeAdmin(db);
});

afterAll(async () => {
  await db.$disconnect();
});

/** An ebook with an uploaded PDF (paid ₹499 at 18% unless `free`). */
async function makeEbook(options: { free?: boolean; active?: boolean; file?: boolean; pricePaise?: number } = {}) {
  counter += 1;
  const ebook = await db.ebook.create({
    data: {
      slug: `test-ebook-${counter}-${randomUUID().slice(0, 6)}`,
      title: `Test ebook ${counter}`,
      description: "A book made by a test.",
      isFree: options.free ?? false,
      pricePaise: options.free ? 0 : (options.pricePaise ?? 49_900),
      gstRate: 18,
      active: options.active ?? true,
    },
  });
  if (options.file !== false) {
    const uploaded = await uploadEbookFile({
      ebookId: ebook.id,
      kind: "file",
      bytes: pdf,
      fileName: "Test book.pdf",
      actorId: adminId,
    });
    if (!uploaded.ok) throw new Error(`upload failed: ${uploaded.error}`);
  }
  return ebook;
}

const viewerOf = (id: string, role = "user") => ({ id, role });

async function addressFor(userId: string) {
  const parsed = parseAddress(validAddress);
  if (!parsed.success) throw new Error("fixture address should be valid");
  const address = await createAddress(userId, parsed.data);
  if (!address.ok) throw new Error("address not created");
  return address.id;
}

/** Puts the user's cart through checkout, and pays unless `pay` is false. */
async function checkout(userId: string, pay = true) {
  const owner: CartOwner = { kind: "user", userId };
  const cart = await readCart(owner, customer, shipping);
  const placed = await placeOrder({
    userId,
    viewer: customer,
    addressId: await addressFor(userId),
    checkoutKey: randomUUID(),
    expectedTotalPaise: cart.totals.totalPaise,
    shipping,
  });
  if (!placed.ok) throw new Error(`order not placed: ${placed.error}`);
  if (pay) {
    const payment = await startPaymentAttempt(placed.orderId);
    if (!payment) throw new Error("no payment attempt");
    await completePayment({ reference: payment.reference, outcome: "succeeded" });
  }
  return placed.orderId;
}

/** A user who bought `ebookId` (paid order). */
async function buyer(ebookId: number) {
  const userId = await makeUser(db);
  const added = await addEbookToCart({ kind: "user", userId }, ebookId);
  if (!added.ok) throw new Error("not added");
  const orderId = await checkout(userId);
  return { userId, orderId };
}

async function readAll(stream: ReadableStream<Uint8Array>) {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe("ebookAccess (the rules)", () => {
  const base: AccessFacts = {
    signedIn: true,
    isAdmin: false,
    isFree: false,
    active: true,
    owned: false,
    hasFile: true,
    siteDownloads: true,
    bookDownloads: true,
  };
  const access = (facts: Partial<AccessFacts>) => ebookAccess({ ...base, ...facts });

  it("guests sign in for free books and buy paid ones", () => {
    expect(access({ signedIn: false, isFree: true })).toBe("sign_in");
    expect(access({ signedIn: false })).toBe("buy");
  });

  it("free books download for anyone signed in", () => {
    expect(access({ isFree: true })).toBe("download");
  });

  it("paid books download only for buyers", () => {
    expect(access({})).toBe("buy");
    expect(access({ owned: true })).toBe("download");
  });

  it("either switch off, or no file, pauses downloads", () => {
    for (const off of [{ siteDownloads: false }, { bookDownloads: false }, { hasFile: false }]) {
      expect(access({ isFree: true, ...off })).toBe("paused");
      expect(access({ owned: true, ...off })).toBe("paused");
      // A non-buyer can still buy a paused book.
      expect(access(off)).toBe("buy");
    }
  });

  it("hidden books: buyers keep them, nobody else gets them", () => {
    expect(access({ active: false, owned: true })).toBe("download");
    expect(access({ active: false })).toBe("unavailable");
    expect(access({ active: false, isFree: true })).toBe("unavailable");
  });

  it("admins can always download a book with a file", () => {
    expect(access({ isAdmin: true, siteDownloads: false })).toBe("download");
    expect(access({ isAdmin: true, hasFile: false })).toBe("paused");
  });
});

describe("downloads", () => {
  it("never serves a guest", async () => {
    const free = await makeEbook({ free: true });
    expect(await openEbookDownload(free.id, null)).toEqual({ ok: false, error: "not_found" });
  });

  it("serves a free book to any signed-in user, with its file and name", async () => {
    const free = await makeEbook({ free: true });
    const userId = await makeUser(db);
    const result = await openEbookDownload(free.id, viewerOf(userId));
    if (!result.ok) throw new Error(result.error);
    expect(result.fileName).toBe("Test book.pdf");
    expect(await readAll(result.file.body)).toEqual(pdf);
  });

  it("refuses a paid book to a non-buyer and serves it to the buyer", async () => {
    const paid = await makeEbook();
    const stranger = await makeUser(db);
    expect(await openEbookDownload(paid.id, viewerOf(stranger))).toEqual({ ok: false, error: "not_found" });
    const { userId } = await buyer(paid.id);
    expect((await openEbookDownload(paid.id, viewerOf(userId))).ok).toBe(true);
  });

  it("an unpaid or cancelled order doesn't make a buyer", async () => {
    const paid = await makeEbook();
    const userId = await makeUser(db);
    await addEbookToCart({ kind: "user", userId }, paid.id);
    await checkout(userId, false);
    expect((await openEbookDownload(paid.id, viewerOf(userId))).ok).toBe(false);

    const bought = await buyer(paid.id);
    expect((await openEbookDownload(paid.id, viewerOf(bought.userId))).ok).toBe(true);
    const cancelled = await cancelOrder(adminId, bought.orderId);
    expect(cancelled.ok).toBe(true);
    expect((await openEbookDownload(paid.id, viewerOf(bought.userId))).ok).toBe(false);
  });

  it("the site-wide switch pauses every download, and admins see it", async () => {
    const free = await makeEbook({ free: true });
    const paid = await makeEbook();
    const { userId } = await buyer(paid.id);
    const reader = await makeUser(db);
    const history = () => db.settingHistory.count({ where: { settingKey: "ebooks.downloads" } });
    const historyBefore = await history();

    await setSiteDownloads(adminId, false);
    expect((await openEbookDownload(free.id, viewerOf(reader))).ok).toBe(false);
    expect((await openEbookDownload(paid.id, viewerOf(userId))).ok).toBe(false);
    const views = await listEbooks(viewerOf(reader));
    expect(views.every((view) => view.paused)).toBe(true);
    // Admins can still check a file.
    expect((await openEbookDownload(paid.id, viewerOf(adminId, "admin"))).ok).toBe(true);

    await setSiteDownloads(adminId, true);
    expect((await openEbookDownload(free.id, viewerOf(reader))).ok).toBe(true);
    const log = await db.adminLog.findMany({ where: { action: "ebooks.downloads.update" } });
    expect(log).toHaveLength(2);
    expect(await history()).toBe(historyBefore + 2);
  });

  it("the per-book switch pauses only that book", async () => {
    const paused = await makeEbook({ free: true });
    const other = await makeEbook({ free: true });
    await db.ebook.update({ where: { id: paused.id }, data: { downloadsEnabled: false } });
    const reader = await makeUser(db);
    expect((await openEbookDownload(paused.id, viewerOf(reader))).ok).toBe(false);
    expect((await openEbookDownload(other.id, viewerOf(reader))).ok).toBe(true);
    const view = await getEbookBySlug(paused.slug, viewerOf(reader));
    expect(view).toMatchObject({ access: "paused", paused: true });
  });

  it("a book without a file isn't downloadable", async () => {
    const empty = await makeEbook({ free: true, file: false });
    const reader = await makeUser(db);
    expect((await openEbookDownload(empty.id, viewerOf(reader))).ok).toBe(false);
  });

  it("is rate-limited per account", async () => {
    const free = await makeEbook({ free: true });
    const reader = await makeUser(db);
    const max = rateLimitRules.ebookDownloadPerUser.max;
    for (let index = 0; index < max; index += 1) {
      const result = await openEbookDownload(free.id, viewerOf(reader));
      if (!result.ok) throw new Error(`download ${index + 1} refused`);
      await result.file.body.cancel();
    }
    const refused = await openEbookDownload(free.id, viewerOf(reader));
    expect(refused).toMatchObject({ ok: false, error: "rate_limited" });
    // Another reader isn't affected.
    expect((await openEbookDownload(free.id, viewerOf(await makeUser(db)))).ok).toBe(true);
  });

  it("hidden books leave the list but stay with their buyers", async () => {
    const paid = await makeEbook();
    const { userId } = await buyer(paid.id);
    await db.ebook.update({ where: { id: paid.id }, data: { active: false } });
    const stranger = await makeUser(db);
    expect(await listEbooks(viewerOf(stranger))).toHaveLength(0);
    expect(await getEbookBySlug(paid.slug, viewerOf(stranger))).toBeNull();
    expect(await getEbookBySlug(paid.slug, viewerOf(userId))).toMatchObject({ access: "download" });
    expect((await listOwnedEbooks(viewerOf(userId))).map((view) => view.id)).toEqual([paid.id]);
    expect((await openEbookDownload(paid.id, viewerOf(userId))).ok).toBe(true);
  });
});

describe("buying through the cart", () => {
  it("adds a paid ebook once, refuses free, hidden and owned ones", async () => {
    const paid = await makeEbook();
    const free = await makeEbook({ free: true });
    const hidden = await makeEbook({ active: false });
    const userId = await makeUser(db);
    const owner: CartOwner = { kind: "user", userId };

    expect(await addEbookToCart(owner, paid.id)).toEqual({ ok: true, count: 1 });
    expect(await addEbookToCart(owner, paid.id)).toEqual({ ok: true, count: 1 });
    expect(await addEbookToCart(owner, free.id)).toEqual({ ok: false, error: { kind: "unavailable" } });
    expect(await addEbookToCart(owner, hidden.id)).toEqual({ ok: false, error: { kind: "unavailable" } });

    await checkout(userId);
    expect(await addEbookToCart(owner, paid.id)).toEqual({ ok: false, error: { kind: "owned" } });
  });

  it("an ebook-only cart has no delivery charge; a mixed one charges delivery on goods only", async () => {
    const paid = await makeEbook({ pricePaise: 99_900 });
    const userId = await makeUser(db);
    const owner: CartOwner = { kind: "user", userId };
    await addEbookToCart(owner, paid.id);
    let cart = await readCart(owner, customer, shipping);
    expect(cart.totals).toMatchObject({ subtotalPaise: 99_900, shippingPaise: 0, totalPaise: 99_900 });

    // ₹320 of goods: delivery applies, even though the total passes ₹999.
    const product = await makeProduct(db);
    await addToCart(owner, product.id, 1);
    cart = await readCart(owner, customer, shipping);
    expect(cart.totals).toMatchObject({ subtotalPaise: 131_900, shippingPaise: 8_000, totalPaise: 139_900 });
    expect(cart.totals.toFreeShippingPaise).toBe(99_900 - 32_000);
  });

  it("paying takes stock only for products, empties the cart and issues an invoice with the ebook's SAC", async () => {
    const paid = await makeEbook();
    const product = await makeProduct(db, { stock: 10 });
    const userId = await makeUser(db);
    const owner: CartOwner = { kind: "user", userId };
    await addEbookToCart(owner, paid.id);
    await addToCart(owner, product.id, 2);
    const orderId = await checkout(userId);

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.status).toBe("paid");
    expect(order.items.find((item) => item.kind === "ebook")).toMatchObject({
      ebookId: paid.id,
      productId: null,
      hsnCode: "998431",
      gstRate: 18,
      quantity: 1,
      lineTotalPaise: 49_900,
    });
    expect(await stockOf(db, product.id)).toBe(8);
    expect(await db.cartItem.count({ where: { cart: { userId } } })).toBe(0);

    const invoice = await issueInvoice(orderId);
    const lines = await db.invoiceLine.findMany({ where: { invoiceId: invoice!.id }, orderBy: { position: "asc" } });
    expect(lines.map((line) => line.hsnCode)).toEqual(["30049011", "998431", "996812"]);
    // Delivery is taxed at the goods' rate (5%), not the ebook's 18%.
    expect(lines[2]!.gstRate).toBe(5);
  });

  it("a cart whose ebook was bought meanwhile can't be checked out", async () => {
    const paid = await makeEbook();
    const userId = await makeUser(db);
    const owner: CartOwner = { kind: "user", userId };
    await addEbookToCart(owner, paid.id);
    const cart = await readCart(owner, customer, shipping);
    // Bought in another order (simulated by a second cart line on another order).
    await checkout(userId);
    await db.cartItem.create({
      data: { cart: { connect: { userId } }, ebook: { connect: { id: paid.id } }, quantity: 1 },
    });
    const again = await readCart(owner, customer, shipping);
    expect(again.ebooks[0]!.issue).toEqual({ kind: "owned" });
    expect(again.hasIssues).toBe(true);
    const placed = await placeOrder({
      userId,
      viewer: customer,
      addressId: await addressFor(userId),
      checkoutKey: randomUUID(),
      expectedTotalPaise: cart.totals.totalPaise,
      shipping,
    });
    expect(placed).toEqual({ ok: false, error: "cart_changed" });
  });

  it("an unpaid order shows the book page as waiting for payment, until it is paid", async () => {
    const paid = await makeEbook();
    const userId = await makeUser(db);
    const viewer = { id: userId, role: "user" };
    await addEbookToCart({ kind: "user", userId }, paid.id);
    const orderId = await checkout(userId, false);
    expect(await getEbookBySlug(paid.slug, viewer)).toMatchObject({ awaitingPaymentOrderId: orderId });
    expect(await getEbookBySlug(paid.slug, null)).toMatchObject({ awaitingPaymentOrderId: null });
    const payment = await startPaymentAttempt(orderId);
    if (!payment) throw new Error("no payment attempt");
    await completePayment({ reference: payment.reference, outcome: "succeeded" });
    expect(await getEbookBySlug(paid.slug, viewer)).toMatchObject({ awaitingPaymentOrderId: null, owned: true });
  });

  it("an ebook-only order has nothing to ship", async () => {
    const paid = await makeEbook();
    const { orderId } = await buyer(paid.id);
    expect(await createShipment(adminId, orderId)).toEqual({ ok: false, error: "nothing_to_ship" });
  });

  it("a guest's ebook moves into the account on sign-in", async () => {
    const paid = await makeEbook();
    const tokenHash = "a".repeat(64);
    await addEbookToCart({ kind: "guest", tokenHash }, paid.id);
    const userId = await makeUser(db);
    await addEbookToCart({ kind: "user", userId }, paid.id);
    expect(await mergeGuestCart(tokenHash, userId)).toBe(0);
    const cart = await readCart({ kind: "user", userId }, customer, shipping);
    expect(cart.ebooks.map((line) => line.ebookId)).toEqual([paid.id]);
  });
});

describe("admin", () => {
  const form = {
    title: "Kidney care handbook",
    slug: "",
    author: "Dr Rao",
    description: "Notes for practitioners.",
    price: "249",
    gstRate: "18",
    downloadsEnabled: "on",
    active: "on",
    sortOrder: "0",
  };

  it("validates the form: price needed unless free, slug from the title", () => {
    const parsed = parseEbookForm(form);
    expect(parsed).toMatchObject({
      success: true,
      data: { slug: "kidney-care-handbook", pricePaise: 24_900, isFree: false },
    });
    expect(parseEbookForm({ ...form, price: "" })).toMatchObject({
      success: false,
      fieldErrors: { price: expect.any(String) },
    });
    expect(parseEbookForm({ ...form, price: "", isFree: "on" })).toMatchObject({
      success: true,
      data: { isFree: true, pricePaise: 0 },
    });
    expect(parseEbookForm({ ...form, gstRate: "7" }).success).toBe(false);
  });

  it("creates, edits and hides an ebook, logging each change", async () => {
    const parsed = parseEbookForm(form);
    if (!parsed.success) throw new Error("form should parse");
    const created = await createEbook(parsed.data, adminId);
    if (!created.ok) throw new Error("not created");
    expect(await createEbook(parsed.data, adminId)).toMatchObject({ ok: false, fieldErrors: { slug: expect.any(String) } });
    const hidden = await updateEbook(created.id, { ...parsed.data, active: false }, adminId);
    expect(hidden).toEqual({ ok: true, id: created.id });
    expect((await db.ebook.findUniqueOrThrow({ where: { id: created.id } })).active).toBe(false);
    const actions = await db.adminLog.findMany({
      where: { resource: "Ebook", resourceId: String(created.id) },
      select: { action: true },
    });
    expect(actions.map((row) => row.action).sort()).toEqual(["ebook.create", "ebook.update"]);
  });

  it("uploads only real PDFs and images, and replaces the old file", async () => {
    const ebook = await makeEbook({ free: true, file: false });
    const notPdf = new TextEncoder().encode("<html>nope</html>");
    expect(
      await uploadEbookFile({ ebookId: ebook.id, kind: "file", bytes: notPdf, fileName: "x.pdf", actorId: adminId }),
    ).toEqual({ ok: false, error: "fileType" });
    // A PDF isn't a cover.
    expect(
      await uploadEbookFile({ ebookId: ebook.id, kind: "cover", bytes: pdf, fileName: "c.pdf", actorId: adminId }),
    ).toEqual({ ok: false, error: "fileType" });

    await uploadEbookFile({ ebookId: ebook.id, kind: "file", bytes: pdf, fileName: "../One.pdf", actorId: adminId });
    const first = await db.ebook.findUniqueOrThrow({ where: { id: ebook.id } });
    expect(first.fileName).toBe("One.pdf");
    await uploadEbookFile({ ebookId: ebook.id, kind: "file", bytes: pdf, fileName: "Two.pdf", actorId: adminId });
    const second = await db.ebook.findUniqueOrThrow({ where: { id: ebook.id } });
    expect(second.fileKey).not.toBe(first.fileKey);
    expect(second.fileKey?.startsWith(`ebooks/${ebook.id}/`)).toBe(true);
    expect(await getStorage().get(first.fileKey!)).toBeNull();
    expect(await getStorage().get(second.fileKey!)).not.toBeNull();
  });
});
