import { inflateSync, constants as zlib } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { settingDefaults } from "@/content/settings";
import { cancelOrder } from "@/server/admin/orders";
import { startPaymentAttempt } from "@/server/checkout/orders";
import { completePayment } from "@/server/checkout/payments";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { getStorage } from "@/server/storage";
import { captureMessages } from "../../../tests/setup/auth";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeAdmin, makeOrder } from "../../../tests/setup/orders";
import { makeUser } from "../../../tests/setup/shop";
import {
  issueCreditNote,
  issueInvoice,
  openOrderDocument,
  readOrderDocuments,
} from "./invoices";
import { renderInvoicePdf, type InvoiceDocument } from "./pdf";

// GST invoices and credit notes (P1.6): issued once on payment and on
// cancelling a paid order, numbered without gaps (also under concurrency),
// per financial year, with the right tax split, and only for the buyer or an
// admin.

let adminId: string;

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
  captureMessages();
  adminId = await makeAdmin(db);
  await db.setting.update({ where: { key: "invoice.seller" }, data: { value: settingDefaults["invoice.seller"] } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

/** The text drawn on a PDF made by pdf-lib (Helvetica text is hex-encoded in its content streams). */
function pdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  const parts: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1], "latin1"), { finishFlush: zlib.Z_SYNC_FLUSH }).toString("latin1");
    } catch {
      content = match[1];
    }
    for (const text of content.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) {
      parts.push(Buffer.from(text[1], "hex").toString("latin1"));
    }
  }
  return parts.join("\n");
}

async function bytesOf(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const invoiceOf = (orderId: string, kind: "invoice" | "credit_note" = "invoice") =>
  db.invoice.findUnique({
    where: { orderId_kind: { orderId, kind } },
    include: { lines: { orderBy: { position: "asc" } } },
  });

const lastNumber = async (kind: "invoice" | "credit_note", financialYear: string) =>
  (await db.invoiceSequence.findUnique({ where: { kind_financialYear: { kind, financialYear } } }))?.lastNumber ?? 0;

/** An unpaid order marked paid straight in the database, so no invoice is issued yet. */
async function paidWithoutInvoice(options: Parameters<typeof makeOrder>[1] = {}) {
  const order = await makeOrder(db, { ...options, pay: false });
  await db.order.update({ where: { id: order.orderId }, data: { status: "paid", paidAt: new Date() } });
  return order;
}

describe("issuing an invoice on payment", () => {
  it("issues one invoice with CGST + SGST in the seller's state, matching the order to the paisa", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T06:00:00Z"));
    // 2 × ₹320 at 5%, plus ₹80 delivery: ₹720.
    const order = await makeOrder(db, { quantity: 2 });
    const invoice = await invoiceOf(order.orderId);
    expect(invoice).toMatchObject({
      kind: "invoice",
      number: "SV/26-27/00001",
      financialYear: "2026-27",
      sequence: 1,
      placeOfSupply: "MH",
      interState: false,
      igstPaise: 0,
      totalPaise: 72_000,
      testPayment: true,
    });
    expect(invoice!.cgstPaise).toBe(invoice!.sgstPaise);
    expect(invoice!.taxablePaise + invoice!.cgstPaise + invoice!.sgstPaise).toBe(72_000);
    expect(invoice!.lines).toHaveLength(2);
    expect(invoice!.lines[0]).toMatchObject({
      position: 1,
      hsnCode: "30049011",
      quantity: 2,
      unitPaise: 32_000,
      gstRate: 5,
      totalPaise: 64_000,
      cgstPaise: 1_524,
      sgstPaise: 1_524,
      taxablePaise: 60_952,
    });
    // Delivery is a line at the goods' rate.
    expect(invoice!.lines[1]).toMatchObject({ hsnCode: "996812", gstRate: 5, totalPaise: 8_000 });
    expect(invoice!.seller).toMatchObject({ gstin: "27AAAAA0000A1Z5", stateCode: "MH", gstCode: "27" });
    expect(invoice!.buyer).toMatchObject({ name: "Asha Rao", phone: "+91 98765 43210", stateCode: "MH" });

    // The PDF is in Storage.
    const stored = await getStorage().get(invoice!.fileKey);
    expect(stored).not.toBeNull();
    const pdf = await bytesOf(stored!.body);
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
    const text = pdfText(pdf);
    expect(text).toContain("Tax invoice");
    expect(text).toContain("SV/26-27/00001");
    expect(text).toContain(order.number);
    expect(text).toContain("GSTIN: 27AAAAA0000A1Z5");
    expect(text).toContain("CGST");
    expect(text).not.toContain("IGST");
    expect(text).toContain("Rs. 720.00");
    expect(text).toContain("Rupees Seven Hundred Twenty Only");
    expect(text).toContain("Test order");
    expect(text).toContain("Page 1 of 1");
  });

  it("uses IGST when the delivery address is in another state", async () => {
    const order = await makeOrder(db, { address: { city: "Bengaluru", state: "KA", pincode: "560001" } });
    const invoice = await invoiceOf(order.orderId);
    expect(invoice).toMatchObject({ placeOfSupply: "KA", interState: true, cgstPaise: 0, sgstPaise: 0 });
    expect(invoice!.taxablePaise + invoice!.igstPaise).toBe(invoice!.totalPaise);
    expect(invoice!.lines[0].igstPaise).toBe(3_048);
    const pdf = await bytesOf((await getStorage().get(invoice!.fileKey))!.body);
    expect(pdfText(pdf)).toContain("IGST");
    expect(pdfText(pdf)).toContain("Karnataka (29)");
  });

  it("issues nothing for an unpaid or failed order", async () => {
    const unpaid = await makeOrder(db, { pay: false });
    expect(await issueInvoice(unpaid.orderId)).toBeNull();
    const payment = await startPaymentAttempt(unpaid.orderId);
    await completePayment({ reference: payment!.reference, outcome: "failed", failureReason: "declined" });
    expect(await issueInvoice(unpaid.orderId)).toBeNull();
    expect(await db.invoice.count()).toBe(0);
    expect(await issueInvoice("not-an-order-id")).toBeNull();
  });

  it("returns the same invoice when asked again", async () => {
    const order = await makeOrder(db);
    const first = await invoiceOf(order.orderId);
    expect(await issueInvoice(order.orderId)).toMatchObject({ id: first!.id, number: first!.number });
    expect(await db.invoice.count()).toBe(1);
  });

  it("keeps an issued invoice as it was when the seller details change later", async () => {
    const order = await makeOrder(db);
    await db.setting.update({
      where: { key: "invoice.seller" },
      data: {
        value: { ...settingDefaults["invoice.seller"], legalName: "New Name Pvt Ltd", stateCode: "KA", gstin: "29AAAAA0000A1Z5" },
      },
    });
    const invoice = await invoiceOf(order.orderId);
    await getStorage().delete(invoice!.fileKey);
    const reopened = await openOrderDocument(order.orderId, "invoice", { id: order.userId });
    const text = pdfText(await bytesOf(reopened!.file.body));
    expect(text).toContain(settingDefaults["invoice.seller"].legalName);
    expect(text).not.toContain("New Name");

    // A new order uses the new details: now the Pune address is in another state.
    const next = await makeOrder(db);
    expect(await invoiceOf(next.orderId)).toMatchObject({ interState: true, seller: { legalName: "New Name Pvt Ltd" } });
  });

  it("falls back to the default seller when the stored setting is invalid", async () => {
    await db.setting.update({
      where: { key: "invoice.seller" },
      // The GSTIN's state code doesn't match the state.
      data: { value: { ...settingDefaults["invoice.seller"], gstin: "29AAAAA0000A1Z5" } },
    });
    const order = await makeOrder(db);
    expect(await invoiceOf(order.orderId)).toMatchObject({ seller: { gstin: "27AAAAA0000A1Z5" } });
  });

  it("doesn't fail the payment when the invoice can't be made, and makes it on download", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const storage = getStorage();
    vi.spyOn(storage, "put").mockRejectedValueOnce(new Error("disk full"));
    const order = await makeOrder(db);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.orderId } })).status).toBe("paid");
    expect(errors).toHaveBeenCalled();
    const invoice = await invoiceOf(order.orderId);
    expect(await storage.get(invoice!.fileKey)).toBeNull();

    const file = await openOrderDocument(order.orderId, "invoice", { id: order.userId });
    expect(file?.fileName).toBe(`Invoice ${invoice!.number.replaceAll("/", "-")}.pdf`);
    expect(await storage.get(invoice!.fileKey)).not.toBeNull();
  });
});

describe("numbering", () => {
  it("gives concurrent payments consecutive numbers with no gaps or repeats", async () => {
    const orders = await Promise.all(Array.from({ length: 8 }, () => makeOrder(db, { pay: false })));
    const payments = await Promise.all(orders.map((order) => startPaymentAttempt(order.orderId)));
    await Promise.all(payments.map((payment) => completePayment({ reference: payment!.reference, outcome: "succeeded" })));

    const invoices = await db.invoice.findMany({ orderBy: { sequence: "asc" } });
    expect(invoices).toHaveLength(8);
    expect(invoices.map((invoice) => invoice.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(invoices.map((invoice) => invoice.orderId)).size).toBe(8);
    // Numbers and dates run in the same order.
    const dates = invoices.map((invoice) => invoice.issuedAt.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
    expect(await lastNumber("invoice", invoices[0].financialYear)).toBe(8);
  });

  it("issues one invoice for one order asked for many times at once, without using up numbers", async () => {
    const order = await paidWithoutInvoice();
    const results = await Promise.all(Array.from({ length: 6 }, () => issueInvoice(order.orderId)));
    expect(new Set(results.map((result) => result?.number)).size).toBe(1);
    expect(await db.invoice.count()).toBe(1);
    const { financialYear } = (await invoiceOf(order.orderId))!;
    expect(await lastNumber("invoice", financialYear)).toBe(1);

    // The next order gets number 2: the losers' numbers were given back.
    const next = await makeOrder(db);
    expect((await invoiceOf(next.orderId))!.sequence).toBe(2);
  });

  it("starts again at 1 each financial year, in India time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 31 Mar 2027, 23:59 IST.
    vi.setSystemTime(new Date("2027-03-31T18:29:00Z"));
    const march = await makeOrder(db);
    // 1 Apr 2027, 00:00 IST.
    vi.setSystemTime(new Date("2027-03-31T18:30:00Z"));
    const april = await makeOrder(db);
    const aprilAgain = await makeOrder(db);
    expect((await invoiceOf(march.orderId))!.number).toBe("SV/26-27/00001");
    expect((await invoiceOf(april.orderId))!.number).toBe("SV/27-28/00001");
    expect((await invoiceOf(aprilAgain.orderId))!.number).toBe("SV/27-28/00002");
  });
});

describe("credit notes", () => {
  it("reverses the invoice when a paid order is cancelled, once", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T06:00:00Z"));
    const order = await makeOrder(db);
    expect(await issueCreditNote(order.orderId)).toBeNull();

    await Promise.all([cancelOrder(adminId, order.orderId), cancelOrder(adminId, order.orderId)]);
    const invoice = await invoiceOf(order.orderId);
    const note = await invoiceOf(order.orderId, "credit_note");
    expect(note).toMatchObject({
      kind: "credit_note",
      number: "CN/26-27/00001",
      originalId: invoice!.id,
      taxablePaise: invoice!.taxablePaise,
      cgstPaise: invoice!.cgstPaise,
      sgstPaise: invoice!.sgstPaise,
      totalPaise: invoice!.totalPaise,
      seller: invoice!.seller,
      buyer: invoice!.buyer,
    });
    expect(note!.lines.map((line) => line.totalPaise)).toEqual(invoice!.lines.map((line) => line.totalPaise));
    expect(await db.invoice.count({ where: { kind: "credit_note" } })).toBe(1);
    expect(await issueCreditNote(order.orderId)).toMatchObject({ id: note!.id });

    const text = pdfText(await bytesOf((await getStorage().get(note!.fileKey))!.body));
    expect(text).toContain("Credit note");
    expect(text).toContain("CN/26-27/00001");
    expect(text).toContain(`${invoice!.number} dated 1 Oct 2026`);
    expect(text).toContain("Order cancelled");
    expect(text).toContain("Total credit");
  });

  it("isn't made for an unpaid order that was cancelled", async () => {
    const order = await makeOrder(db, { pay: false });
    await cancelOrder(adminId, order.orderId);
    expect(await issueCreditNote(order.orderId)).toBeNull();
    expect(await db.invoice.count()).toBe(0);
  });

  it("makes the missing invoice first when a cancelled paid order has none", async () => {
    const order = await paidWithoutInvoice();
    await db.order.update({ where: { id: order.orderId }, data: { status: "cancelled", cancelledAt: new Date() } });
    const note = await issueCreditNote(order.orderId);
    const invoice = await invoiceOf(order.orderId);
    expect(note).not.toBeNull();
    expect(invoice).not.toBeNull();
    expect((await invoiceOf(order.orderId, "credit_note"))!.originalId).toBe(invoice!.id);
  });
});

describe("downloads", () => {
  it("are for the buyer and admins only", async () => {
    const order = await makeOrder(db);
    const stranger = await makeUser(db);
    const owner = await openOrderDocument(order.orderId, "invoice", { id: order.userId, role: "user" });
    expect(owner?.fileName).toMatch(/^Invoice SV-\d\d-\d\d-00001\.pdf$/);
    expect(Buffer.from((await bytesOf(owner!.file.body)).slice(0, 5)).toString()).toBe("%PDF-");
    expect(await openOrderDocument(order.orderId, "invoice", { id: adminId, role: "admin" })).not.toBeNull();
    expect(await openOrderDocument(order.orderId, "invoice", { id: stranger, role: "user" })).toBeNull();
    // No credit note until the order is cancelled.
    expect(await openOrderDocument(order.orderId, "credit_note", { id: order.userId })).toBeNull();
    expect(await openOrderDocument("x".repeat(22), "invoice", { id: adminId, role: "admin" })).toBeNull();
  });

  it("make the invoice of a paid order on first download, but never for an unpaid one", async () => {
    const paid = await paidWithoutInvoice();
    const file = await openOrderDocument(paid.orderId, "invoice", { id: paid.userId });
    expect(file).not.toBeNull();
    expect(await db.invoice.count()).toBe(1);

    const unpaid = await makeOrder(db, { pay: false });
    expect(await openOrderDocument(unpaid.orderId, "invoice", { id: unpaid.userId })).toBeNull();
    expect(await db.invoice.count()).toBe(1);
  });

  it("are listed for the order pages", async () => {
    const order = await makeOrder(db);
    const read = async () =>
      readOrderDocuments(await db.order.findUniqueOrThrow({ where: { id: order.orderId } }));
    const invoice = await invoiceOf(order.orderId);
    expect(await read()).toEqual({
      invoice: { available: true, number: invoice!.number },
      creditNote: { available: false, number: null },
    });
    await cancelOrder(adminId, order.orderId);
    expect((await read()).creditNote).toEqual({ available: true, number: expect.stringMatching(/^CN\//) });

    const unpaid = await makeOrder(db, { pay: false });
    expect(await readOrderDocuments(await db.order.findUniqueOrThrow({ where: { id: unpaid.orderId } }))).toEqual({
      invoice: { available: false, number: null },
      creditNote: { available: false, number: null },
    });
  });
});

describe("the PDF", () => {
  const base: InvoiceDocument = {
    kind: "invoice",
    number: "SV/26-27/00007",
    issuedAt: new Date("2026-10-01T06:00:00Z"),
    orderNumber: "SV-7K2Q9F4M",
    orderDate: new Date("2026-10-01T05:00:00Z"),
    original: null,
    seller: {
      legalName: "Saatvik Vaidya",
      addressLines: ["1 Test Road"],
      city: "Mumbai",
      pincode: "400001",
      stateCode: "MH",
      stateName: "Maharashtra",
      gstCode: "27",
      gstin: "27AAAAA0000A1Z5",
    },
    buyer: {
      name: "Asha Rao",
      phone: "+91 98765 43210",
      addressLines: ["Flat 4", "Pune, Maharashtra 411001"],
      stateCode: "MH",
      stateName: "Maharashtra",
      gstCode: "27",
    },
    interState: false,
    lines: [],
    totals: { taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, totalPaise: 0 },
    testPayment: false,
  };
  const line = {
    hsnCode: "30049011",
    quantity: 1,
    unitPaise: 10_500,
    gstRate: 5,
    taxablePaise: 10_000,
    cgstPaise: 250,
    sgstPaise: 250,
    igstPaise: 0,
    totalPaise: 10_500,
  };

  it("runs onto more pages for long orders, repeating the table header", async () => {
    const lines = Array.from({ length: 60 }, (_, index) => ({
      ...line,
      description: `Product number ${index + 1} with a fairly long name that wraps onto a second line (60 tablets)`,
    }));
    const bytes = await renderInvoicePdf({ ...base, lines });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(pdf.getTitle()).toBe("Tax invoice SV/26-27/00007");
    const text = pdfText(bytes);
    expect(text).toContain("Product number 60");
    expect(text).toContain(`Page ${pdf.getPageCount()} of ${pdf.getPageCount()}`);
    // Every page of lines starts with the table header; the totals add one more.
    const headers = text.match(/Item\nHSN\/SAC/g)!.length;
    expect(headers).toBeGreaterThan(1);
    expect(text.match(/Taxable value/g)!.length).toBe(headers + 1);
  });

  it("prints names the standard font can't, without failing", async () => {
    const bytes = await renderInvoicePdf({
      ...base,
      buyer: { ...base.buyer, name: "José आशा ₹" },
      lines: [{ ...line, description: "Ashwagandhā — चूर्ण 100 g" }],
    });
    const text = pdfText(bytes);
    expect(text).toContain("Jose ??? Rs.");
    expect(text).toContain("Ashwagandha");
  });
});
