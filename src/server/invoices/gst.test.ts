import { describe, expect, it } from "vitest";
import {
  DELIVERY_SAC,
  amountInWords,
  deliveryLine,
  documentNumber,
  documentTotals,
  financialYearOf,
  numberInWords,
  taxLine,
  type LineInput,
} from "./gst";

// GST maths for invoices (P1.6): tax splits, rounding, financial years,
// numbering and amounts in words. No database.

const line = (totalPaise: number, gstRate: number, quantity = 1): LineInput => ({
  description: "Test vati (60 tablets)",
  hsnCode: "30049011",
  quantity,
  unitPaise: totalPaise / quantity,
  gstRate,
  totalPaise,
});

describe("taxLine", () => {
  it("splits GST inside an inclusive price into equal CGST and SGST in the seller's state", () => {
    // ₹105 at 5%: ₹100 taxable, ₹2.50 + ₹2.50.
    expect(taxLine(line(10_500, 5), false)).toMatchObject({
      taxablePaise: 10_000,
      cgstPaise: 250,
      sgstPaise: 250,
      igstPaise: 0,
      totalPaise: 10_500,
    });
  });

  it("puts all of it in IGST between states", () => {
    expect(taxLine(line(10_500, 5), true)).toMatchObject({
      taxablePaise: 10_000,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 500,
    });
    // 18%: ₹1,180 holds ₹180.
    expect(taxLine(line(118_000, 18), true)).toMatchObject({ taxablePaise: 100_000, igstPaise: 18_000 });
  });

  it("has no tax at 0%", () => {
    expect(taxLine(line(9_999, 0), false)).toMatchObject({ taxablePaise: 9_999, cgstPaise: 0, sgstPaise: 0 });
    expect(taxLine(line(9_999, 0), true)).toMatchObject({ taxablePaise: 9_999, igstPaise: 0 });
  });

  it("always adds up to the line total, with CGST equal to SGST and each within a paisa of the rate", () => {
    for (const rate of [0, 3, 5, 12, 18, 28]) {
      for (let total = 1; total <= 50_000; total += 37) {
        const intra = taxLine(line(total, rate), false);
        expect(intra.cgstPaise).toBe(intra.sgstPaise);
        expect(intra.taxablePaise + intra.cgstPaise + intra.sgstPaise).toBe(total);
        expect(Math.abs(intra.cgstPaise - (intra.taxablePaise * rate) / 200)).toBeLessThanOrEqual(1);

        const inter = taxLine(line(total, rate), true);
        expect(inter.taxablePaise + inter.igstPaise).toBe(total);
        expect(Math.abs(inter.igstPaise - (inter.taxablePaise * rate) / 100)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("rounds an odd paisa of GST into the taxable value, not into one half", () => {
    // ₹105.21 at 5%: 501.0 paise of GST in total, 250.5 each half.
    const split = taxLine(line(10_521, 5), false);
    expect(split.cgstPaise).toBe(split.sgstPaise);
    expect(split.taxablePaise + 2 * split.cgstPaise).toBe(10_521);
  });
});

describe("deliveryLine", () => {
  it("is free when there's no charge", () => {
    expect(deliveryLine(0, [{ gstRate: 5 }], "Delivery charge")).toBeNull();
  });

  it("takes the highest GST rate of the goods, with the courier SAC", () => {
    expect(deliveryLine(8_000, [{ gstRate: 5 }, { gstRate: 12 }, { gstRate: 0 }], "Delivery charge")).toEqual({
      description: "Delivery charge",
      hsnCode: DELIVERY_SAC,
      quantity: 1,
      unitPaise: 8_000,
      gstRate: 12,
      totalPaise: 8_000,
    });
  });
});

describe("documentTotals", () => {
  it("adds up every column", () => {
    const lines = [line(64_000, 5, 2), line(11_800, 18), line(8_000, 18)].map((l) => taxLine(l, false));
    const totals = documentTotals(lines);
    expect(totals.totalPaise).toBe(83_800);
    expect(totals.cgstPaise).toBe(totals.sgstPaise);
    expect(totals.taxablePaise + totals.cgstPaise + totals.sgstPaise + totals.igstPaise).toBe(83_800);
  });
});

describe("financialYearOf", () => {
  it("runs April to March in India time", () => {
    expect(financialYearOf(new Date("2026-10-01T10:00:00Z"))).toBe("2026-27");
    expect(financialYearOf(new Date("2027-01-15T10:00:00Z"))).toBe("2026-27");
    // 31 Mar 2027 23:59 IST is still 2026-27; a minute later it's 2027-28.
    expect(financialYearOf(new Date("2027-03-31T18:29:59Z"))).toBe("2026-27");
    expect(financialYearOf(new Date("2027-03-31T18:30:00Z"))).toBe("2027-28");
    expect(financialYearOf(new Date("2099-06-01T00:00:00Z"))).toBe("2099-00");
  });
});

describe("documentNumber", () => {
  it("numbers invoices and credit notes per financial year, within GST's 16 characters", () => {
    expect(documentNumber("invoice", "2026-27", 1)).toBe("SV/26-27/00001");
    expect(documentNumber("credit_note", "2026-27", 42)).toBe("CN/26-27/00042");
    expect(documentNumber("invoice", "2099-00", 99_999)).toBe("SV/99-00/99999");
    expect(documentNumber("invoice", "2026-27", 999_999)).toBe("SV/26-27/999999");
  });

  it("refuses a sequence it can't print", () => {
    expect(() => documentNumber("invoice", "2026-27", 0)).toThrow(RangeError);
    expect(() => documentNumber("invoice", "2026-27", 1.5)).toThrow(RangeError);
    expect(() => documentNumber("invoice", "2026-27", 1_000_000)).toThrow(RangeError);
  });
});

describe("amounts in words", () => {
  it("uses Indian numbering", () => {
    expect(numberInWords(0)).toBe("Zero");
    expect(numberInWords(7)).toBe("Seven");
    expect(numberInWords(19)).toBe("Nineteen");
    expect(numberInWords(40)).toBe("Forty");
    expect(numberInWords(99)).toBe("Ninety-Nine");
    expect(numberInWords(100)).toBe("One Hundred");
    expect(numberInWords(1_005)).toBe("One Thousand Five");
    expect(numberInWords(1_00_000)).toBe("One Lakh");
    expect(numberInWords(12_34_567)).toBe("Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven");
    expect(numberInWords(5_00_00_000)).toBe("Five Crore");
    expect(numberInWords(1_23_45_67_890)).toBe(
      "One Hundred Twenty-Three Crore Forty-Five Lakh Sixty-Seven Thousand Eight Hundred Ninety",
    );
  });

  it("says rupees and paise", () => {
    expect(amountInWords(72_000)).toBe("Rupees Seven Hundred Twenty Only");
    expect(amountInWords(72_050)).toBe("Rupees Seven Hundred Twenty and Fifty Paise Only");
    expect(amountInWords(1)).toBe("Rupees Zero and One Paise Only");
    expect(() => amountInWords(-1)).toThrow(RangeError);
  });
});
