import { gstIncluded } from "@/server/checkout/totals";

// GST maths for tax invoices and credit notes (docs/CHUNKS.md, P1.6). Pure
// functions with no database access, so splits, rounding and numbering are
// easy to test.
//
// Prices include GST. Each line's GST is the part of its total that is tax
// (as at checkout, src/server/checkout/totals.ts) and the rest is its
// taxable value. When the seller and the delivery address are in the same
// state the GST is split into equal CGST and SGST; otherwise it is all IGST.
// Every line adds up to exactly what the buyer paid for it, so a document's
// total is always the order's total to the paisa.

export type InvoiceKind = "invoice" | "credit_note";

/**
 * SAC for the delivery charge (courier services). Delivery is part of a
 * composite supply, so it takes the GST rate of the goods: the highest rate
 * on the order (see "Decisions" in docs/PROGRESS.md, P1.6).
 */
export const DELIVERY_SAC = "996812";

export type LineInput = {
  description: string;
  hsnCode: string;
  quantity: number;
  /** One unit, including GST. */
  unitPaise: number;
  gstRate: number;
  /** The whole line, including GST. */
  totalPaise: number;
};

export type TaxedLine = LineInput & {
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
};

/**
 * Splits a GST-inclusive line into its taxable value and tax. Within one
 * state, CGST and SGST are always equal (half the rate each, rounded to the
 * paisa), and the taxable value takes whatever is left, so the three add up
 * to the line total exactly.
 */
export function taxLine(line: LineInput, interState: boolean): TaxedLine {
  const { totalPaise, gstRate } = line;
  if (interState) {
    const igstPaise = gstIncluded(totalPaise, gstRate);
    return { ...line, taxablePaise: totalPaise - igstPaise, cgstPaise: 0, sgstPaise: 0, igstPaise };
  }
  const half = gstRate <= 0 ? 0 : Math.round((totalPaise * gstRate) / (2 * (100 + gstRate)));
  return { ...line, taxablePaise: totalPaise - 2 * half, cgstPaise: half, sgstPaise: half, igstPaise: 0 };
}

/** The delivery charge as a line, at the highest GST rate of the goods; null when free. */
export function deliveryLine(
  shippingPaise: number,
  goods: readonly { gstRate: number }[],
  description: string,
): LineInput | null {
  if (shippingPaise <= 0) return null;
  const gstRate = Math.max(0, ...goods.map((line) => line.gstRate));
  return {
    description,
    hsnCode: DELIVERY_SAC,
    quantity: 1,
    unitPaise: shippingPaise,
    gstRate,
    totalPaise: shippingPaise,
  };
}

export type DocumentTotals = {
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
};

export function documentTotals(lines: readonly TaxedLine[]): DocumentTotals {
  const totals: DocumentTotals = { taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, totalPaise: 0 };
  for (const line of lines) {
    totals.taxablePaise += line.taxablePaise;
    totals.cgstPaise += line.cgstPaise;
    totals.sgstPaise += line.sgstPaise;
    totals.igstPaise += line.igstPaise;
    totals.totalPaise += line.totalPaise;
  }
  return totals;
}

const IST_OFFSET_MS = 5.5 * 3600_000;

/**
 * The Indian financial year (April to March, India time) of a moment:
 * 31 Mar 2027 23:59 IST is "2026-27", 1 Apr 2027 00:00 IST is "2027-28".
 */
export function financialYearOf(date: Date): string {
  const india = new Date(date.getTime() + IST_OFFSET_MS);
  const year = india.getUTCFullYear();
  const start = india.getUTCMonth() >= 3 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

const prefixes: Record<InvoiceKind, string> = { invoice: "SV", credit_note: "CN" };

/**
 * "SV/26-27/00001" for the first invoice of 2026-27, "CN/26-27/00001" for
 * the first credit note. GST invoice numbers may be at most 16 characters
 * (these are 14 up to 99,999 a year, and 15 up to the 999,999 limit).
 */
export function documentNumber(kind: InvoiceKind, financialYear: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999_999) {
    throw new RangeError(`Invoice sequence out of range: ${sequence}`);
  }
  const short = `${financialYear.slice(2, 4)}-${financialYear.slice(5, 7)}`;
  return `${prefixes[kind]}/${short}/${String(sequence).padStart(5, "0")}`;
}

// ─── Amount in words (Indian numbering: thousand, lakh, crore) ──────────────

const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ones[n];
  const unit = n % 10;
  return unit ? `${tens[Math.floor(n / 10)]}-${ones[unit]}` : tens[Math.floor(n / 10)];
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ones[hundreds]} Hundred` : "", rest ? belowHundred(rest) : ""]
    .filter(Boolean)
    .join(" ");
}

/** 1234567 -> "Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven". */
export function numberInWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`Not a whole amount: ${n}`);
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1_000);
  const rest = n % 1_000;
  return [
    crore ? `${numberInWords(crore)} Crore` : "",
    lakh ? `${belowHundred(lakh)} Lakh` : "",
    thousand ? `${belowHundred(thousand)} Thousand` : "",
    rest ? belowThousand(rest) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** 72050 paise -> "Rupees Seven Hundred Twenty and Fifty Paise Only". */
export function amountInWords(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise < 0) throw new RangeError(`Not an amount: ${paise}`);
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  return `Rupees ${numberInWords(rupees)}${rest ? ` and ${belowHundred(rest)} Paise` : ""} Only`;
}
