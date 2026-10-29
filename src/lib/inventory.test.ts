import { describe, expect, it } from "vitest";
import {
  EXPIRY_WARN_DAYS,
  daysToExpiry,
  expiryState,
  formatQuantity,
  isLow,
  toBaseQuantity,
  unitsMakeable,
} from "./inventory";

const line = (quantity: number, available: number, madeToOrder = false, componentId = 1) => ({
  componentId,
  quantity,
  available,
  madeToOrder,
});

describe("unitsMakeable (recipe availability)", () => {
  it("is the smallest available/per-unit over the recipe", () => {
    // 200 ml syrup: 1 bottle, 1 cap, 1 label, 200 ml of base.
    const lines = [line(1, 500, false, 1), line(1, 450, false, 2), line(1, 900, false, 3), line(200, 30_000, false, 4)];
    expect(unitsMakeable(lines, 1)).toBe(150); // 30,000 ml / 200 ml
  });

  it("rounds down to the product's order step (its minimum)", () => {
    expect(unitsMakeable([line(1, 107)], 12)).toBe(96);
    expect(unitsMakeable([line(1, 11)], 12)).toBe(0);
  });

  it("ignores a made-to-order base", () => {
    const lines = [line(1, 40, false, 1), line(100, 0, true, 2)];
    expect(unitsMakeable(lines, 1)).toBe(40);
  });

  it("is null (no limit) without a recipe or with only made-to-order lines", () => {
    expect(unitsMakeable([], 4)).toBeNull();
    expect(unitsMakeable([line(100, 0, true)], 4)).toBeNull();
  });

  it("treats negative availability (over-reserved) as none", () => {
    expect(unitsMakeable([line(1, -30)], 1)).toBe(0);
  });
});

describe("quantities", () => {
  it("converts typed amounts to base units", () => {
    expect(toBaseQuantity("2.5", "L", "ml")).toBe(2500);
    expect(toBaseQuantity("1,200", "pcs", "pcs")).toBe(1200);
    expect(toBaseQuantity("0.75", "kg", "g")).toBe(750);
  });

  it("refuses text, a unit the item doesn't use and absurd sizes", () => {
    expect(toBaseQuantity("abc", "pcs", "pcs")).toBeNull();
    expect(toBaseQuantity("5", "L", "pcs")).toBeNull();
    expect(toBaseQuantity("1e9", "pcs", "pcs")).toBeNull();
    expect(toBaseQuantity("99999999999", "pcs", "pcs")).toBeNull();
  });

  it("shows litres and kilograms from 1000", () => {
    expect(formatQuantity(1500, "ml")).toBe("1.5 L");
    expect(formatQuantity(800, "ml")).toBe("800 ml");
    expect(formatQuantity(2500, "g")).toBe("2.5 kg");
    expect(formatQuantity(1250, "pcs")).toBe("1,250 pcs");
  });

  it("alerts at or below the level, never when the level is 0", () => {
    expect(isLow(10, 10)).toBe(true);
    expect(isLow(11, 10)).toBe(false);
    expect(isLow(0, 0)).toBe(false);
  });
});

describe("expiry", () => {
  const today = new Date("2026-10-03T10:00:00Z");
  const on = (date: string) => new Date(`${date}T00:00:00Z`);

  it("counts whole days", () => {
    expect(daysToExpiry(on("2026-10-03"), today)).toBe(0);
    expect(daysToExpiry(on("2026-10-02"), today)).toBe(-1);
    expect(daysToExpiry(null, today)).toBeNull();
  });

  it("is expired the day after, soon within the warning window", () => {
    expect(expiryState(on("2026-10-02"), today)).toBe("expired");
    expect(expiryState(on("2026-10-03"), today)).toBe("soon");
    expect(expiryState(new Date(+on("2026-10-03") + EXPIRY_WARN_DAYS * 86_400_000), today)).toBe("soon");
    expect(expiryState(new Date(+on("2026-10-03") + (EXPIRY_WARN_DAYS + 1) * 86_400_000), today)).toBe("ok");
    expect(expiryState(null, today)).toBe("none");
  });
});
