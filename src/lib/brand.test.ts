import { describe, expect, it } from "vitest";
import {
  MAX_BRAND_ORDER_PAISE,
  MAX_BRAND_UNITS,
  brandTermsOf,
  isContactNumber,
  isValidBrandQuantity,
  launchStepNumber,
  maxBrandQuantity,
  snapBrandQuantity,
  stepBrandQuantity,
} from "./brand";

// Launch Your Brand quantity rules (P2.1): the minimum is also the step.

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
    expect(brandTermsOf(product)).toEqual({ minQty: 4, unitPricePaise: 26_000, unitLabel: "jars" });
    expect(brandTermsOf({ ...product, brandEligible: false })).toBeNull();
    expect(brandTermsOf({ ...product, brandMinQty: null })).toBeNull();
    expect(brandTermsOf({ ...product, brandUnitPricePaise: 0 })).toBeNull();
    expect(brandTermsOf({ ...product, brandUnitLabel: null })).toBeNull();
  });
});

describe("launch helpers", () => {
  it("reads the step from the URL, defaulting to 1", () => {
    expect(launchStepNumber("3")).toBe(3);
    expect(launchStepNumber(["4"])).toBe(4);
    for (const bad of [undefined, "", "0", "5", "2a", "-1"]) expect(launchStepNumber(bad)).toBe(1);
  });

  it("accepts contact numbers of 8 to 15 digits", () => {
    expect(isContactNumber("+91 92203 58400")).toBe(true);
    expect(isContactNumber("(022) 2345-6789")).toBe(true);
    expect(isContactNumber("1234567")).toBe(false);
    expect(isContactNumber("call me maybe")).toBe(false);
    expect(isContactNumber("+91 92203 58400 1234")).toBe(false);
  });
});
