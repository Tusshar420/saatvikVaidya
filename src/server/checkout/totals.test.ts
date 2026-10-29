import { describe, expect, it } from "vitest";
import { computeTotals, gstIncluded, shippingFor } from "./totals";

// Totals with GST included in the prices (P1.4).

const shipping = { feePaise: 8_000, freeFromPaise: 99_900 };

describe("gstIncluded", () => {
  it("finds the GST inside an inclusive amount", () => {
    expect(gstIncluded(10_500, 5)).toBe(500);
    expect(gstIncluded(11_200, 12)).toBe(1_200);
    expect(gstIncluded(11_800, 18)).toBe(1_800);
    expect(gstIncluded(10_000, 0)).toBe(0);
  });

  it("rounds to the nearest paisa", () => {
    // 32,000 × 5 / 105 = 1,523.8…
    expect(gstIncluded(32_000, 5)).toBe(1_524);
    // 15,000 × 12 / 112 = 1,607.1…
    expect(gstIncluded(15_000, 12)).toBe(1_607);
  });
});

describe("shippingFor", () => {
  it("charges the fee below the free threshold and nothing from it", () => {
    expect(shippingFor(50_000, shipping)).toBe(8_000);
    expect(shippingFor(99_899, shipping)).toBe(8_000);
    expect(shippingFor(99_900, shipping)).toBe(0);
  });

  it("charges nothing for an empty cart and always charges when never free", () => {
    expect(shippingFor(0, shipping)).toBe(0);
    expect(shippingFor(5_000_000, { feePaise: 5_000, freeFromPaise: null })).toBe(5_000);
  });
});

describe("computeTotals", () => {
  it("adds line totals, groups GST by rate and adds delivery", () => {
    const totals = computeTotals(
      [
        { lineTotalPaise: 64_000, gstRate: 5 },
        { lineTotalPaise: 15_000, gstRate: 12 },
        { lineTotalPaise: 10_500, gstRate: 5 },
      ],
      shipping,
    );
    expect(totals.subtotalPaise).toBe(89_500);
    // Each line's GST is rounded on its own, then summed per rate.
    expect(totals.gst).toEqual([
      { rate: 5, taxablePaise: 64_000 - 3_048 + 10_500 - 500, taxPaise: 3_048 + 500 },
      { rate: 12, taxablePaise: 15_000 - 1_607, taxPaise: 1_607 },
    ]);
    expect(totals.taxPaise).toBe(3_048 + 500 + 1_607);
    expect(totals.shippingPaise).toBe(8_000);
    expect(totals.totalPaise).toBe(97_500);
    expect(totals.toFreeShippingPaise).toBe(10_400);
  });

  it("has free delivery from the threshold", () => {
    const totals = computeTotals([{ lineTotalPaise: 120_000, gstRate: 5 }], shipping);
    expect(totals.shippingPaise).toBe(0);
    expect(totals.totalPaise).toBe(120_000);
    expect(totals.toFreeShippingPaise).toBeNull();
  });

  it("is all zeros for no lines", () => {
    expect(computeTotals([], shipping)).toEqual({
      subtotalPaise: 0,
      taxPaise: 0,
      gst: [],
      shippingPaise: 0,
      coinDiscountPaise: 0,
      lineDiscountsPaise: [],
      totalPaise: 0,
      freeFromPaise: 99_900,
      toFreeShippingPaise: null,
    });
  });
});
