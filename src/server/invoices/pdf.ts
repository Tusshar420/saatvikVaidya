import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { invoices as copy } from "@/content/invoices";
import { formatDate } from "@/lib/format";
import { amountInWords, type DocumentTotals, type InvoiceKind, type TaxedLine } from "./gst";

// Draws a tax invoice or credit note as an A4 PDF with pdf-lib (P1.6). Only
// the data passed in is used, so the same rows always give the same document.
// The standard Helvetica font has no "₹" or Devanagari, so amounts are
// printed as "Rs." and any character it can't print becomes "?".

export type SellerSnapshot = {
  legalName: string;
  addressLines: string[];
  city: string;
  pincode: string;
  stateCode: string;
  stateName: string;
  gstCode: string;
  gstin: string;
};

export type BuyerSnapshot = {
  name: string;
  phone: string;
  /** Address lines, the last with city, state and PIN code. */
  addressLines: string[];
  stateCode: string;
  stateName: string;
  gstCode: string;
};

export type InvoiceDocument = {
  kind: InvoiceKind;
  number: string;
  issuedAt: Date;
  orderNumber: string;
  orderDate: Date;
  /** For a credit note: the invoice it reverses. */
  original: { number: string; issuedAt: Date } | null;
  seller: SellerSnapshot;
  buyer: BuyerSnapshot;
  interState: boolean;
  lines: TaxedLine[];
  totals: DocumentTotals;
  testPayment: boolean;
};

const text = copy.pdf;

// The DESIGN.md colour tokens (a PDF can't read the CSS variables).
const colour = {
  ink: rgb(0x14 / 255, 0x26 / 255, 0x2c / 255),
  muted: rgb(0x65 / 255, 0x74 / 255, 0x7a / 255),
  line: rgb(0xdf / 255, 0xe8 / 255, 0xe5 / 255),
  teal: rgb(0x08 / 255, 0x73 / 255, 0x7a / 255),
  surfaceAlt: rgb(0xf8 / 255, 0xfb / 255, 0xfa / 255),
  danger: rgb(0xc6 / 255, 0x41 / 255, 0x1b / 255),
};

const PAGE: [number, number] = [595.28, 841.89]; // A4 in points
const MARGIN = 40;
const RIGHT = PAGE[0] - MARGIN;
const CONTENT_WIDTH = RIGHT - MARGIN;
/** Room kept at the bottom of each page for the footer. */
const FOOTER_SPACE = 44;

const amountFormat = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
/** 125050 -> "1,250.50" (always with paise, as invoices are). */
const rupees = (paise: number) => amountFormat.format(paise / 100);

type Fonts = { regular: PDFFont; bold: PDFFont; printable: Set<number> };

/** Text the standard font can print: accents dropped, unknown characters as "?". */
function printable(fonts: Fonts, value: string): string {
  return Array.from(
    value
      .replace(/₹/g, "Rs.")
      .replace(/\s+/g, " ")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, ""),
  )
    .map((char) => (fonts.printable.has(char.codePointAt(0) ?? 0) ? char : "?"))
    .join("");
}

/** Splits text into lines no wider than `width`; very long words are cut. */
function wrap(font: PDFFont, size: number, value: string, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of value.split(" ").filter(Boolean)) {
    let piece = word;
    while (font.widthOfTextAtSize(piece, size) > width) {
      let cut = piece.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(piece.slice(0, cut), size) > width) cut--;
      if (current) lines.push(current);
      lines.push(piece.slice(0, cut));
      current = "";
      piece = piece.slice(cut);
    }
    const next = current ? `${current} ${piece}` : piece;
    if (font.widthOfTextAtSize(next, size) <= width) {
      current = next;
    } else {
      lines.push(current);
      current = piece;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

type Style = { font?: PDFFont; size?: number; color?: RGB; align?: "left" | "right" };

class Writer {
  pages: PDFPage[] = [];
  page!: PDFPage;
  /** Distance from the bottom of the page to the next baseline area. */
  y = 0;

  constructor(
    private readonly pdf: PDFDocument,
    readonly fonts: Fonts,
  ) {
    this.addPage();
  }

  addPage() {
    this.page = this.pdf.addPage(PAGE);
    this.pages.push(this.page);
    this.y = PAGE[1] - MARGIN;
  }

  /** Space left above the footer. */
  get room() {
    return this.y - MARGIN - FOOTER_SPACE;
  }

  /** Draws one line of text with its baseline at `y`; `x` is the right edge when right-aligned. */
  draw(value: string, x: number, y: number, style: Style = {}) {
    const font = style.font ?? this.fonts.regular;
    const size = style.size ?? 9;
    const clean = printable(this.fonts, value);
    const left = style.align === "right" ? x - font.widthOfTextAtSize(clean, size) : x;
    this.page.drawText(clean, { x: left, y, font, size, color: style.color ?? colour.ink });
  }

  rule(y: number, color = colour.line) {
    this.page.drawLine({
      start: { x: MARGIN, y },
      end: { x: RIGHT, y },
      thickness: 0.75,
      color,
    });
  }
}

/** A column of the line table: where it starts, how wide, and its alignment. */
type Column = { key: string; label: string; width: number; align: "left" | "right" };

function tableColumns(interState: boolean): Column[] {
  const c = text.columns;
  const tax: Column[] = interState
    ? [{ key: "igst", label: c.igst, width: 62, align: "right" }]
    : [
        { key: "cgst", label: c.cgst, width: 54, align: "right" },
        { key: "sgst", label: c.sgst, width: 54, align: "right" },
      ];
  const fixed: Column[] = [
    { key: "index", label: c.index, width: 18, align: "left" },
    { key: "hsn", label: c.hsn, width: 50, align: "left" },
    { key: "quantity", label: c.quantity, width: 32, align: "right" },
    { key: "taxable", label: c.taxable, width: 70, align: "right" },
    { key: "rate", label: c.rate, width: 32, align: "right" },
    ...tax,
    { key: "amount", label: c.amount, width: 68, align: "right" },
  ];
  const used = fixed.reduce((sum, column) => sum + column.width, 0);
  // The item description takes the rest of the width, after "#".
  return [
    fixed[0],
    { key: "item", label: c.item, width: CONTENT_WIDTH - used, align: "left" },
    ...fixed.slice(1),
  ];
}

const CELL_PAD = 4;
const ROW_SIZE = 8.5;
const ROW_LEADING = 11;

function drawTableHeader(writer: Writer, columns: Column[]) {
  const height = 20;
  writer.page.drawRectangle({
    x: MARGIN,
    y: writer.y - height,
    width: CONTENT_WIDTH,
    height,
    color: colour.surfaceAlt,
  });
  let x = MARGIN;
  for (const column of columns) {
    writer.draw(
      column.label,
      column.align === "right" ? x + column.width - CELL_PAD : x + CELL_PAD,
      writer.y - 13.5,
      { font: writer.fonts.bold, size: 8, color: colour.muted, align: column.align },
    );
    x += column.width;
  }
  writer.y -= height;
  writer.rule(writer.y);
}

function cellValues(line: TaxedLine, index: number): Record<string, string> {
  return {
    index: String(index + 1),
    hsn: line.hsnCode,
    quantity: String(line.quantity),
    taxable: rupees(line.taxablePaise),
    rate: `${line.gstRate}%`,
    cgst: rupees(line.cgstPaise),
    sgst: rupees(line.sgstPaise),
    igst: rupees(line.igstPaise),
    amount: rupees(line.totalPaise),
  };
}

function drawLines(writer: Writer, doc: InvoiceDocument) {
  const columns = tableColumns(doc.interState);
  const itemColumn = columns.find((column) => column.key === "item")!;
  const itemWidth = itemColumn.width - 2 * CELL_PAD;
  drawTableHeader(writer, columns);

  doc.lines.forEach((line, index) => {
    const { regular, bold } = writer.fonts;
    const description = wrap(bold, ROW_SIZE, printable(writer.fonts, line.description), itemWidth);
    const unit = wrap(
      regular,
      7.5,
      text.unitLine(String(line.quantity), rupees(line.unitPaise)),
      itemWidth,
    );
    const height = (description.length + unit.length) * ROW_LEADING + 2 * CELL_PAD;
    if (writer.room < height) {
      writer.addPage();
      drawTableHeader(writer, columns);
    }
    const top = writer.y - CELL_PAD - 8.5;
    const values = cellValues(line, index);
    let x = MARGIN;
    for (const column of columns) {
      if (column.key === "item") {
        description.forEach((part, row) =>
          writer.draw(part, x + CELL_PAD, top - row * ROW_LEADING, { font: bold, size: ROW_SIZE }),
        );
        unit.forEach((part, row) =>
          writer.draw(part, x + CELL_PAD, top - (description.length + row) * ROW_LEADING, {
            size: 7.5,
            color: colour.muted,
          }),
        );
      } else {
        writer.draw(
          values[column.key],
          column.align === "right" ? x + column.width - CELL_PAD : x + CELL_PAD,
          top,
          { size: ROW_SIZE, align: column.align },
        );
      }
      x += column.width;
    }
    writer.y -= height;
    writer.rule(writer.y);
  });
}

/** A block of label/value rows on the right; returns its height. */
function drawPairs(
  writer: Writer,
  pairs: [string, string][],
  top: number,
  options: { labelX: number; valueRight: number; size?: number },
): number {
  const size = options.size ?? 9;
  const leading = size + 5;
  // Labels take the first 80 points; values are right-aligned in the rest.
  const valueWidth = options.valueRight - options.labelX - 80;
  let y = top;
  for (const [label, value] of pairs) {
    writer.draw(label, options.labelX, y, { size, color: colour.muted });
    const lines = wrap(writer.fonts.bold, size, printable(writer.fonts, value), valueWidth);
    lines.forEach((line, index) =>
      writer.draw(line, options.valueRight, y - index * leading, {
        font: writer.fonts.bold,
        size,
        align: "right",
      }),
    );
    y -= lines.length * leading;
  }
  return top - y;
}

function drawHeader(writer: Writer, doc: InvoiceDocument) {
  const { regular, bold } = writer.fonts;
  const { seller, buyer } = doc;
  const top = writer.y;

  // Seller, top left.
  const sellerWidth = 290;
  let y = top - 12;
  for (const line of wrap(bold, 13, printable(writer.fonts, seller.legalName), sellerWidth)) {
    writer.draw(line, MARGIN, y, { font: bold, size: 13 });
    y -= 16;
  }
  const sellerLines = [
    ...seller.addressLines,
    `${seller.city} ${seller.pincode}`,
    text.state(seller.stateName, seller.gstCode),
  ];
  for (const part of sellerLines) {
    for (const line of wrap(regular, 9, printable(writer.fonts, part), sellerWidth)) {
      writer.draw(line, MARGIN, y, { color: colour.muted });
      y -= 12;
    }
  }
  writer.draw(text.gstin(seller.gstin), MARGIN, y, { font: bold });
  y -= 12;

  // Title, top right.
  writer.draw(text.title[doc.kind], RIGHT, top - 16, {
    font: bold,
    size: 18,
    color: colour.teal,
    align: "right",
  });
  if (doc.kind === "invoice") {
    writer.draw(text.copy, RIGHT, top - 30, { size: 8, color: colour.muted, align: "right" });
  }

  writer.y = Math.min(y, top - 40) - 6;
  writer.rule(writer.y, colour.ink);
  writer.y -= 18;

  // Buyer on the left, document details on the right.
  const detailsTop = writer.y;
  writer.draw(text.buyer, MARGIN, detailsTop, { font: bold, size: 8, color: colour.muted });
  y = detailsTop - 15;
  for (const line of wrap(bold, 10, printable(writer.fonts, buyer.name), 250)) {
    writer.draw(line, MARGIN, y, { font: bold, size: 10 });
    y -= 13;
  }
  for (const part of [...buyer.addressLines, text.phone(buyer.phone)]) {
    for (const line of wrap(regular, 9, printable(writer.fonts, part), 250)) {
      writer.draw(line, MARGIN, y);
      y -= 12;
    }
  }

  const pairs: [string, string][] = [
    [text.number[doc.kind], doc.number],
    [text.date, formatDate(doc.issuedAt)],
    [text.orderNumber, doc.orderNumber],
    [text.orderDate, formatDate(doc.orderDate)],
  ];
  if (doc.original) {
    pairs.push(
      [text.againstInvoice, text.againstInvoiceValue(doc.original.number, formatDate(doc.original.issuedAt))],
      [text.reason, text.reasonCancelled],
    );
  }
  pairs.push(
    [text.placeOfSupply, text.placeOfSupplyValue(buyer.stateName, buyer.gstCode)],
    [text.reverseCharge, text.no],
  );
  const used = drawPairs(writer, pairs, detailsTop, { labelX: 300, valueRight: RIGHT });

  writer.y = Math.min(y, detailsTop - used) - 10;
  writer.draw(text.amountsIn, RIGHT, writer.y, { size: 7.5, color: colour.muted, align: "right" });
  writer.y -= 6;
}

function drawTotals(writer: Writer, doc: InvoiceDocument) {
  const { totals } = doc;
  const t = text.totals;
  const rows: [string, string][] = [[t.taxable, rupees(totals.taxablePaise)]];
  if (doc.interState) rows.push([t.igst, rupees(totals.igstPaise)]);
  else rows.push([t.cgst, rupees(totals.cgstPaise)], [t.sgst, rupees(totals.sgstPaise)]);

  const words = wrap(
    writer.fonts.regular,
    9,
    printable(writer.fonts, amountInWords(totals.totalPaise)),
    CONTENT_WIDTH,
  );
  const note = doc.testPayment
    ? wrap(writer.fonts.bold, 9, printable(writer.fonts, text.testPayment), CONTENT_WIDTH)
    : [];
  const needed = rows.length * 14 + 30 + 20 + words.length * 12 + (note.length ? note.length * 12 + 14 : 0);
  if (writer.room < needed) writer.addPage();

  const labelX = RIGHT - 220;
  let y = writer.y - 16;
  for (const [label, value] of rows) {
    writer.draw(label, labelX, y, { color: colour.muted });
    writer.draw(value, RIGHT, y, { align: "right" });
    y -= 14;
  }
  writer.page.drawLine({
    start: { x: labelX, y: y + 6 },
    end: { x: RIGHT, y: y + 6 },
    thickness: 0.75,
    color: colour.ink,
  });
  y -= 8;
  writer.draw(t.total[doc.kind], labelX, y, { font: writer.fonts.bold, size: 11 });
  writer.draw(`Rs. ${rupees(totals.totalPaise)}`, RIGHT, y, {
    font: writer.fonts.bold,
    size: 11,
    align: "right",
  });
  y -= 24;

  writer.draw(text.inWords, MARGIN, y, { font: writer.fonts.bold, size: 8, color: colour.muted });
  y -= 13;
  for (const line of words) {
    writer.draw(line, MARGIN, y);
    y -= 12;
  }
  if (note.length) {
    y -= 8;
    for (const line of note) {
      writer.draw(line, MARGIN, y, { font: writer.fonts.bold, color: colour.danger });
      y -= 12;
    }
  }
  writer.y = y;
}

function drawFooters(writer: Writer) {
  const total = writer.pages.length;
  writer.pages.forEach((page, index) => {
    writer.page = page;
    writer.rule(MARGIN + 14);
    writer.draw(text.footer, MARGIN, MARGIN, { size: 7.5, color: colour.muted });
    writer.draw(text.page(index + 1, total), RIGHT, MARGIN, {
      size: 7.5,
      color: colour.muted,
      align: "right",
    });
  });
}

/** The document as PDF bytes. */
export async function renderInvoicePdf(doc: InvoiceDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const title = `${text.title[doc.kind]} ${doc.number}`;
  pdf.setTitle(title);
  pdf.setAuthor(doc.seller.legalName);
  pdf.setCreator(doc.seller.legalName);
  pdf.setProducer(doc.seller.legalName);
  // Fixed dates, so a rebuilt file matches the first one.
  pdf.setCreationDate(doc.issuedAt);
  pdf.setModificationDate(doc.issuedAt);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonts: Fonts = {
    regular,
    bold,
    printable: new Set(regular.getCharacterSet()),
  };
  const writer = new Writer(pdf, fonts);
  drawHeader(writer, doc);
  drawLines(writer, doc);
  drawTotals(writer, doc);
  drawFooters(writer);
  return pdf.save();
}
