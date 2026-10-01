import "server-only";
import { z } from "zod";
import type { Invoice, Prisma } from "@/generated/prisma/client";
import { invoices as copy } from "@/content/invoices";
import { addressLines } from "@/lib/address";
import { indianState } from "@/lib/india";
import { isOrderId } from "@/lib/orders";
import { formatIndianPhone } from "@/lib/phone";
import { resolveSetting } from "@/server/content/settings";
import { db } from "@/server/db";
import { getStorage, newFileKey, type StoredFile } from "@/server/storage";
import {
  deliveryLine,
  documentNumber,
  documentTotals,
  financialYearOf,
  taxLine,
  type InvoiceKind,
  type LineInput,
  type TaxedLine,
} from "./gst";
import { renderInvoicePdf, type BuyerSnapshot, type InvoiceDocument, type SellerSnapshot } from "./pdf";

// GST tax invoices and credit notes (docs/CHUNKS.md, P1.6).
//
// - issueInvoice(): once an order is paid. completePayment() calls it; the
//   download route calls it too, so a paid order whose invoice couldn't be
//   made at payment time still gets one (the same one, never two).
// - issueCreditNote(): once a paid order is cancelled (cancelOrder() calls
//   it, and the download route as above). It reverses the whole invoice.
//
// Numbers run 1, 2, 3... per kind and financial year with no gaps: the next
// number is taken from InvoiceSequence inside the transaction that writes
// the document, with the sequence row locked, so concurrent payments queue
// for it and a rolled-back document gives its number back. Everything on
// the document is copied into Invoice/InvoiceLine; the PDF is drawn from
// those rows and saved in Storage after the transaction, and drawn again
// from them if the file is ever missing.

export type IssuedDocument = Pick<Invoice, "id" | "kind" | "number" | "issuedAt" | "fileKey" | "orderId">;

const issuedSelect = {
  id: true,
  kind: true,
  number: true,
  issuedAt: true,
  fileKey: true,
  orderId: true,
} as const satisfies Prisma.InvoiceSelect;

function isUniqueClash(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

/** A deadlock or lock wait that MySQL rolled back; safe to run again. */
function isRetryable(error: unknown): boolean {
  if (error instanceof YearChanged) return true;
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && (error as { code: unknown }).code === "P2034") return true;
  const message = String((error as { message?: unknown }).message ?? "");
  return /deadlock|lock wait timeout|1213|1205/i.test(message);
}

/** The financial year ended while waiting for the sequence lock; start again. */
class YearChanged extends Error {}

async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= 5 || !isRetryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt + Math.random() * 20));
    }
  }
}

/**
 * Takes the next number for `kind` in `financialYear`. The row stays locked
 * until the transaction ends, so no one else can take a number meanwhile.
 */
async function nextSequence(
  tx: Prisma.TransactionClient,
  kind: InvoiceKind,
  financialYear: string,
): Promise<number> {
  await tx.$executeRaw`
    INSERT INTO InvoiceSequence (kind, financialYear, lastNumber)
    VALUES (${kind}, ${financialYear}, 1)
    ON DUPLICATE KEY UPDATE lastNumber = lastNumber + 1`;
  const [row] = await tx.$queryRaw<{ lastNumber: number }[]>`
    SELECT lastNumber FROM InvoiceSequence
    WHERE kind = ${kind} AND financialYear = ${financialYear}
    FOR UPDATE`;
  return Number(row.lastNumber);
}

type DocumentData = {
  seller: SellerSnapshot;
  buyer: BuyerSnapshot;
  placeOfSupply: string;
  interState: boolean;
  lines: TaxedLine[];
  testPayment: boolean;
  originalId: number | null;
};

/**
 * Writes a document with the next number, or returns the one the order
 * already has (also when another request wrote it a moment earlier).
 */
async function writeDocument(
  kind: InvoiceKind,
  orderId: string,
  data: DocumentData,
): Promise<{ document: IssuedDocument; created: boolean }> {
  const totals = documentTotals(data.lines);
  try {
    const document = await withRetry(() =>
      db.$transaction(async (tx) => {
        const financialYear = financialYearOf(new Date());
        const sequence = await nextSequence(tx, kind, financialYear);
        // Dated after the lock, so numbers and dates run in the same order.
        const issuedAt = new Date();
        if (financialYearOf(issuedAt) !== financialYear) throw new YearChanged();
        const number = documentNumber(kind, financialYear, sequence);
        return tx.invoice.create({
          data: {
            kind,
            number,
            financialYear,
            sequence,
            orderId,
            originalId: data.originalId,
            issuedAt,
            seller: data.seller,
            buyer: data.buyer,
            placeOfSupply: data.placeOfSupply,
            interState: data.interState,
            ...totals,
            testPayment: data.testPayment,
            fileKey: newFileKey("invoices", orderId, "pdf"),
            lines: {
              create: data.lines.map((line, index) => ({
                position: index + 1,
                description: line.description.slice(0, 200),
                hsnCode: line.hsnCode,
                quantity: line.quantity,
                unitPaise: line.unitPaise,
                gstRate: line.gstRate,
                taxablePaise: line.taxablePaise,
                cgstPaise: line.cgstPaise,
                sgstPaise: line.sgstPaise,
                igstPaise: line.igstPaise,
                totalPaise: line.totalPaise,
              })),
            },
          },
          select: issuedSelect,
        });
      }),
    );
    return { document, created: true };
  } catch (error) {
    // The order got this kind of document from a concurrent request; its
    // transaction rolled back, number included.
    if (!isUniqueClash(error)) throw error;
    const document = await db.invoice.findUnique({
      where: { orderId_kind: { orderId, kind } },
      select: issuedSelect,
    });
    if (!document) throw error;
    return { document, created: false };
  }
}

/** The seller details from the "invoice.seller" setting, read fresh (not cached). */
async function readSeller(): Promise<SellerSnapshot> {
  const row = await db.setting.findUnique({ where: { key: "invoice.seller" }, select: { value: true } });
  const seller = resolveSetting("invoice.seller", row?.value);
  const state = indianState(seller.stateCode);
  if (!state) throw new Error(`invoice.seller has an unknown state: ${seller.stateCode}`);
  return {
    legalName: seller.legalName,
    addressLines: [...seller.addressLines],
    city: seller.city,
    pincode: seller.pincode,
    stateCode: state.code,
    stateName: state.name,
    gstCode: state.gstCode,
    gstin: seller.gstin,
  };
}

async function findIssued(orderId: string, kind: InvoiceKind): Promise<IssuedDocument | null> {
  return db.invoice.findUnique({ where: { orderId_kind: { orderId, kind } }, select: issuedSelect });
}

/** Draws the PDF and saves it; a failure is logged (the download draws it again). */
async function storeQuietly(document: IssuedDocument): Promise<void> {
  try {
    await storeFile(document.id);
  } catch (error) {
    console.error(`[invoices] PDF for ${document.number} not stored; it is drawn on download.`, error);
  }
}

/**
 * The order's tax invoice, made now if it doesn't have one yet. Null if the
 * order doesn't exist or was never paid.
 */
export async function issueInvoice(orderId: string): Promise<IssuedDocument | null> {
  if (!isOrderId(orderId)) return null;
  const existing = await findIssued(orderId, "invoice");
  if (existing) return existing;

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      paidAt: true,
      shipName: true,
      shipPhone: true,
      shipLine1: true,
      shipLine2: true,
      shipLandmark: true,
      shipCity: true,
      shipState: true,
      shipPincode: true,
      shippingPaise: true,
      totalPaise: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          productName: true,
          packSize: true,
          hsnCode: true,
          quantity: true,
          unitPaise: true,
          gstRate: true,
          lineTotalPaise: true,
          discountPaise: true,
          kind: true,
        },
      },
      payments: { where: { status: "succeeded" }, select: { provider: true } },
    },
  });
  if (!order?.paidAt) return null;

  const seller = await readSeller();
  const buyerState = indianState(order.shipState);
  if (!buyerState) throw new Error(`Order ${orderId} has an unknown state: ${order.shipState}`);
  const interState = buyerState.code !== seller.stateCode;
  const goods: LineInput[] = order.items.map((item) => ({
    description: `${item.productName} (${item.packSize})`,
    hsnCode: item.hsnCode,
    quantity: item.quantity,
    unitPaise: item.unitPaise,
    gstRate: item.gstRate,
    totalPaise: item.lineTotalPaise - item.discountPaise,
  }));
  // Delivery is taxed with the goods it carries, so ebooks (P1.8) don't set its rate.
  const delivered = goods.filter((_, index) => order.items[index]!.kind !== "ebook");
  const delivery = deliveryLine(order.shippingPaise, delivered, copy.pdf.deliveryCharge);
  const lines = [...goods, ...(delivery ? [delivery] : [])].map((line) => taxLine(line, interState));
  const total = documentTotals(lines).totalPaise;
  if (total !== order.totalPaise) {
    throw new Error(`Invoice lines for order ${orderId} add up to ${total}, not ${order.totalPaise}.`);
  }

  const { document, created } = await writeDocument("invoice", orderId, {
    seller,
    buyer: {
      name: order.shipName,
      phone: formatIndianPhone(order.shipPhone),
      addressLines: addressLines({
        name: order.shipName,
        phone: order.shipPhone,
        line1: order.shipLine1,
        line2: order.shipLine2,
        landmark: order.shipLandmark,
        city: order.shipCity,
        state: order.shipState,
        pincode: order.shipPincode,
      }),
      stateCode: buyerState.code,
      stateName: buyerState.name,
      gstCode: buyerState.gstCode,
    },
    placeOfSupply: buyerState.code,
    interState,
    lines,
    testPayment: order.payments.some((payment) => payment.provider === "test"),
    originalId: null,
  });
  if (created) await storeQuietly(document);
  return document;
}

/**
 * The credit note for a paid order that was cancelled, made now if it
 * doesn't have one yet: the whole invoice reversed (the invoice is made
 * first if it's missing). Null for any other order.
 */
export async function issueCreditNote(orderId: string): Promise<IssuedDocument | null> {
  if (!isOrderId(orderId)) return null;
  const existing = await findIssued(orderId, "credit_note");
  if (existing) return existing;
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true, paidAt: true },
  });
  if (!order || order.status !== "cancelled" || !order.paidAt) return null;

  const invoice = await issueInvoice(orderId);
  if (!invoice) return null;
  const original = await db.invoice.findUniqueOrThrow({
    where: { id: invoice.id },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  const { document, created } = await writeDocument("credit_note", orderId, {
    seller: sellerSchema.parse(original.seller),
    buyer: buyerSchema.parse(original.buyer),
    placeOfSupply: original.placeOfSupply,
    interState: original.interState,
    lines: original.lines.map((line) => ({
      description: line.description,
      hsnCode: line.hsnCode,
      quantity: line.quantity,
      unitPaise: line.unitPaise,
      gstRate: line.gstRate,
      taxablePaise: line.taxablePaise,
      cgstPaise: line.cgstPaise,
      sgstPaise: line.sgstPaise,
      igstPaise: line.igstPaise,
      totalPaise: line.totalPaise,
    })),
    testPayment: original.testPayment,
    originalId: original.id,
  });
  if (created) await storeQuietly(document);
  return document;
}

/** Runs `issue` for its side effect without failing the caller (payment, cancel). */
export async function issueQuietly(
  issue: (orderId: string) => Promise<unknown>,
  orderId: string,
): Promise<void> {
  try {
    await issue(orderId);
  } catch (error) {
    console.error(`[invoices] document for order ${orderId} not issued; it is made on download.`, error);
  }
}

// ─── Drawing and storing the PDF ────────────────────────────────────────────

const sellerSchema = z.object({
  legalName: z.string(),
  addressLines: z.array(z.string()),
  city: z.string(),
  pincode: z.string(),
  stateCode: z.string(),
  stateName: z.string(),
  gstCode: z.string(),
  gstin: z.string(),
}) satisfies z.ZodType<SellerSnapshot>;

const buyerSchema = z.object({
  name: z.string(),
  phone: z.string(),
  addressLines: z.array(z.string()),
  stateCode: z.string(),
  stateName: z.string(),
  gstCode: z.string(),
}) satisfies z.ZodType<BuyerSnapshot>;

/** Everything the PDF shows, from the stored rows. */
export async function readDocument(invoiceId: number): Promise<InvoiceDocument> {
  const row = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      lines: { orderBy: { position: "asc" } },
      order: { select: { number: true, createdAt: true } },
      original: { select: { number: true, issuedAt: true } },
    },
  });
  return {
    kind: row.kind,
    number: row.number,
    issuedAt: row.issuedAt,
    orderNumber: row.order.number,
    orderDate: row.order.createdAt,
    original: row.original,
    seller: sellerSchema.parse(row.seller),
    buyer: buyerSchema.parse(row.buyer),
    interState: row.interState,
    lines: row.lines.map((line) => ({
      description: line.description,
      hsnCode: line.hsnCode,
      quantity: line.quantity,
      unitPaise: line.unitPaise,
      gstRate: line.gstRate,
      taxablePaise: line.taxablePaise,
      cgstPaise: line.cgstPaise,
      sgstPaise: line.sgstPaise,
      igstPaise: line.igstPaise,
      totalPaise: line.totalPaise,
    })),
    totals: {
      taxablePaise: row.taxablePaise,
      cgstPaise: row.cgstPaise,
      sgstPaise: row.sgstPaise,
      igstPaise: row.igstPaise,
      totalPaise: row.totalPaise,
    },
    testPayment: row.testPayment,
  };
}

/** Draws the document's PDF and saves it under its key. */
export async function storeFile(invoiceId: number): Promise<void> {
  const document = await readDocument(invoiceId);
  const { fileKey } = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { fileKey: true },
  });
  await getStorage().put(fileKey, await renderInvoicePdf(document));
}

// ─── Downloads ──────────────────────────────────────────────────────────────

export type DocumentFile = { fileName: string; file: StoredFile };

/**
 * The PDF of an order's invoice or credit note, for the order's buyer or an
 * admin. Null for anyone else, and when the order has no such document (an
 * unpaid order has no invoice; only a paid, cancelled one has a credit note),
 * so callers can answer every case with the same 404.
 */
export async function openOrderDocument(
  orderId: string,
  kind: InvoiceKind,
  viewer: { id: string; role?: string | null },
): Promise<DocumentFile | null> {
  if (!isOrderId(orderId)) return null;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { userId: true } });
  if (!order) return null;
  if (order.userId !== viewer.id && viewer.role !== "admin") return null;

  const document = kind === "invoice" ? await issueInvoice(orderId) : await issueCreditNote(orderId);
  if (!document) return null;
  const storage = getStorage();
  let file = await storage.get(document.fileKey);
  if (!file) {
    await storeFile(document.id);
    file = await storage.get(document.fileKey);
    if (!file) return null;
  }
  return { fileName: copy.fileName(kind, document.number), file };
}

export type OrderDocuments = {
  invoice: { available: boolean; number: string | null };
  creditNote: { available: boolean; number: string | null };
};

/** What the order pages show: which documents exist or can be downloaded. */
export async function readOrderDocuments(order: {
  id: string;
  status: string;
  paidAt: Date | null;
}): Promise<OrderDocuments> {
  const issued = await db.invoice.findMany({
    where: { orderId: order.id },
    select: { kind: true, number: true },
  });
  const numberOf = (kind: InvoiceKind) => issued.find((row) => row.kind === kind)?.number ?? null;
  const paid = order.paidAt !== null;
  return {
    invoice: { available: paid, number: numberOf("invoice") },
    creditNote: { available: paid && order.status === "cancelled", number: numberOf("credit_note") },
  };
}
