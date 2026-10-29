import { describe, expect, it } from "vitest";
import {
  MAX_BRAND_ORDER_PAISE,
  MAX_BRAND_UNITS,
  brandLineTotal,
  brandTermsOf,
  brandUnitPriceFor,
  isContactNumber,
  isValidBrandQuantity,
  launchStepNumber,
  maxBrandQuantity,
  nextBrandTier,
  snapBrandQuantity,
  stepBrandQuantity,
  usableBrandTiers,
} from "./brand";
import { MAX_PACK_MRP_RUPEES, brandThemeOf, brandThemes, packMrpProblem } from "./brand-theme";

// Build Your Brand quantity rules (P2.1): the minimum is also the step.

const four = { minQty: 4, unitPricePaise: 26_000 };

describe("brand quantities", () => {
  it("allows only positive multiples of the minimum", () => {
    expect(isValidBrandQuantity(4, four)).toBe(true);
    expect(isValidBrandQuantity(8, four)).toBe(true);
    expect(isValidBrandQuantity(12, four)).toBe(true);
    for (const bad of [0, -4, 1, 2, 3, 5, 6, 7, 9, 4.5, Number.NaN, Infinity]) {
      expect(isValidBrandQuantity(bad, four)).toBe(false);
    }
  });

  it("steps + and − by the minimum, never below it", () => {
    expect(stepBrandQuantity(4, four, "up")).toBe(8);
    expect(stepBrandQuantity(8, four, "up")).toBe(12);
    expect(stepBrandQuantity(12, four, "down")).toBe(8);
    expect(stepBrandQuantity(4, four, "down")).toBe(4);
    // A quantity off the step is moved onto it first.
    expect(stepBrandQuantity(5, four, "up")).toBe(12);
  });

  it("moves a typed number up to the next allowed one", () => {
    expect(snapBrandQuantity(1, four)).toBe(4);
    expect(snapBrandQuantity(5, four)).toBe(8);
    expect(snapBrandQuantity(8, four)).toBe(8);
    expect(snapBrandQuantity(-3, four)).toBe(4);
    expect(snapBrandQuantity(Number.NaN, four)).toBe(4);
  });

  it("caps the quantity by units and by order value, on the step", () => {
    const cheap = { minQty: 3, unitPricePaise: 100 };
    expect(maxBrandQuantity(cheap)).toBe(99_999);
    expect(maxBrandQuantity(cheap) % 3).toBe(0);
    expect(maxBrandQuantity(cheap)).toBeLessThanOrEqual(MAX_BRAND_UNITS);
    const dear = { minQty: 50, unitPricePaise: 10_000_000 };
    expect(maxBrandQuantity(dear) * dear.unitPricePaise).toBeLessThanOrEqual(MAX_BRAND_ORDER_PAISE);
    expect(maxBrandQuantity(dear)).toBe(100);
    expect(isValidBrandQuantity(150, dear)).toBe(false);
    expect(stepBrandQuantity(100, dear, "up")).toBe(100);
    expect(snapBrandQuantity(1_000_000, four)).toBe(maxBrandQuantity(four));
  });

  it("has no allowed quantity for a broken minimum", () => {
    expect(maxBrandQuantity({ minQty: 0, unitPricePaise: 100 })).toBe(0);
    expect(isValidBrandQuantity(4, { minQty: 0, unitPricePaise: 100 })).toBe(false);
  });
});

describe("brandTermsOf", () => {
  const product = {
    brandEligible: true,
    brandMinQty: 4,
    brandUnitPricePaise: 26_000,
    brandUnitLabel: "jars",
  };

  it("needs the switch on and every term set", () => {
    expect(brandTermsOf(product)).toEqual({ minQty: 4, unitPricePaise: 26_000, unitLabel: "jars", tiers: [] });
    expect(brandTermsOf({ ...product, brandEligible: false })).toBeNull();
    expect(brandTermsOf({ ...product, brandMinQty: null })).toBeNull();
    expect(brandTermsOf({ ...product, brandUnitPricePaise: 0 })).toBeNull();
    expect(brandTermsOf({ ...product, brandUnitLabel: null })).toBeNull();
  });
});

describe("bulk tiers", () => {
  const terms = brandTermsOf({
    brandEligible: true,
    brandMinQty: 10,
    brandUnitPricePaise: 10_000,
    brandUnitLabel: "packs",
    brandTiers: [
      { minQuantity: 100, pricePaise: 8_000 },
      { minQuantity: 45, pricePaise: 9_000 },
    ],
  })!;

  it("sorts the tiers and prices each quantity at the tier it reaches", () => {
    expect(terms.tiers).toEqual([
      { minQty: 45, unitPricePaise: 9_000 },
      { minQty: 100, unitPricePaise: 8_000 },
    ]);
    expect(brandUnitPriceFor(terms, 10)).toBe(10_000);
    expect(brandUnitPriceFor(terms, 40)).toBe(10_000);
    expect(brandUnitPriceFor(terms, 50)).toBe(9_000);
    expect(brandUnitPriceFor(terms, 100)).toBe(8_000);
    expect(brandUnitPriceFor(terms, 5_000)).toBe(8_000);
    expect(brandLineTotal(terms, 50)).toBe(450_000);
  });

  it("says how many more units reach the next tier, on the step", () => {
    // 45 isn't a multiple of 10, so the next allowed quantity is 50.
    expect(nextBrandTier(terms, 20)).toEqual({ tier: terms.tiers[0], quantity: 50, unitsMore: 30 });
    expect(nextBrandTier(terms, 50)).toEqual({ tier: terms.tiers[1], quantity: 100, unitsMore: 50 });
    expect(nextBrandTier(terms, 100)).toBeNull();
  });

  it("drops tiers that can't apply", () => {
    const base = { minQty: 10, unitPricePaise: 10_000 };
    expect(
      usableBrandTiers(base, [
        { minQuantity: 10, pricePaise: 9_000 }, // not above the minimum
        { minQuantity: 20, pricePaise: 10_000 }, // not cheaper than the base price
        { minQuantity: 30, pricePaise: 9_500 },
        { minQuantity: 40, pricePaise: 9_600 }, // dearer than the tier before
        { minQuantity: MAX_BRAND_UNITS + 1, pricePaise: 1 }, // beyond the cap
        { minQuantity: 60, pricePaise: 0 },
      ]),
    ).toEqual([{ minQty: 30, unitPricePaise: 9_500 }]);
  });
});

describe("launch helpers", () => {
  it("reads the step from the URL, defaulting to 1", () => {
    expect(launchStepNumber("3")).toBe(3);
    expect(launchStepNumber(["2"])).toBe(2);
    for (const bad of [undefined, "", "0", "4", "5", "2a", "-1"]) expect(launchStepNumber(bad)).toBe(1);
  });

  it("accepts contact numbers of 8 to 15 digits", () => {
    expect(isContactNumber("+91 92203 58400")).toBe(true);
    expect(isContactNumber("(022) 2345-6789")).toBe(true);
    expect(isContactNumber("1234567")).toBe(false);
    expect(isContactNumber("call me maybe")).toBe(false);
    expect(isContactNumber("+91 92203 58400 1234")).toBe(false);
  });
});

describe("pack MRP", () => {
  it("accepts whole rupees from the net rate up to the cap", () => {
    expect(packMrpProblem(260, 26_000)).toBeNull();
    expect(packMrpProblem(MAX_PACK_MRP_RUPEES, 26_000)).toBeNull();
    expect(packMrpProblem(259, 26_000)).toBe("low");
    expect(packMrpProblem(MAX_PACK_MRP_RUPEES + 1, 26_000)).toBe("high");
    for (const bad of [0, -5, 1.5, Number.NaN]) expect(packMrpProblem(bad, 26_000)).toBe("missing");
  });

  it("knows the four label themes and falls back to the first", () => {
    expect(brandThemes.map((theme) => theme.key)).toEqual([
      "classic-green",
      "saffron-glow",
      "royal-maroon",
      "minimal-white",
    ]);
    expect(brandThemeOf("royal-maroon").key).toBe("royal-maroon");
    for (const unknown of [null, undefined, "", "neon"]) expect(brandThemeOf(unknown).key).toBe("classic-green");
  });
});
