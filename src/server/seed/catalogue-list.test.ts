import { describe, expect, it } from "vitest";
import { buildProducts } from "./catalogue-load";
import { catalogueRows, extraForms, unitLabels } from "./catalogue-list";

describe("client catalogue list", () => {
  const products = buildProducts();

  it("has a unique slug per product, within the column size", () => {
    const slugs = products.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug.length).toBeLessThanOrEqual(120);
  });

  it("keeps prices sane: professional price at most the MRP", () => {
    for (const p of products) {
      expect(p.professionalPricePaise).toBeGreaterThan(0);
      expect(p.professionalPricePaise).toBeLessThanOrEqual(p.mrpPaise);
      expect(p.brandMinQty).toBeGreaterThan(0);
    }
  });

  it("uses only known forms", () => {
    const known = new Set([
      "avaleha", "asava-arishta", "churna", "guggulu", "vati-gutika",
      "taila-ghrita", ...extraForms.map((f) => f.key),
    ]);
    for (const [form] of catalogueRows) {
      expect(known.has(form)).toBe(true);
      expect(unitLabels[form]).toBeDefined();
    }
  });
});
