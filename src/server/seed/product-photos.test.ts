import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { brandThemeKeys, MAX_BRAND_VARIANTS, MAX_VARIANT_NAME, variantKeyPattern } from "@/lib/brand-theme";
import { MAX_PRODUCT_IMAGES } from "@/lib/catalogue";
import { catalogueRows } from "./catalogue-list";
import {
  LABEL_PHOTOS_DIR,
  photoAlt,
  photoSets,
  photoVariantKey,
  photoVariantStyle,
  preparedFileName,
} from "./product-photos";

describe("client label photos", () => {
  const catalogueNames = new Set(catalogueRows.map((row) => row[1]));

  it("names only products that are in the catalogue list", () => {
    for (const set of photoSets) {
      for (const name of set.products) expect(catalogueNames, name).toContain(name);
    }
  });

  it("gives each medicine to one set only", () => {
    const names = photoSets.flatMap((set) => set.products);
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses each file once", () => {
    const files = photoSets.flatMap((set) => set.photos.map((photo) => photo.file));
    expect(new Set(files).size).toBe(files.length);
  });

  it("fits the variant and photo limits (one extra photo for the shop)", () => {
    for (const set of photoSets) {
      expect(set.photos.length).toBeGreaterThan(0);
      expect(set.photos.length).toBeLessThanOrEqual(MAX_BRAND_VARIANTS);
      expect(set.photos.length + 1).toBeLessThanOrEqual(MAX_PRODUCT_IMAGES);
    }
  });

  it("names every variant, with a unique valid key per medicine", () => {
    for (const set of photoSets) {
      const keys = set.photos.map((photo) => {
        expect(photo.name.length).toBeGreaterThan(0);
        expect(photo.name.length).toBeLessThanOrEqual(MAX_VARIANT_NAME);
        return photoVariantKey(photo.name);
      });
      for (const key of keys) expect(key).toMatch(variantKeyPattern);
      expect(new Set(keys).size, set.products.join()).toBe(keys.length);
    }
  });

  it("has a committed web copy of every photo, and no others", () => {
    const expected = photoSets.flatMap((set) => set.photos.map((photo) => preparedFileName(photo.file)));
    expect(new Set(expected).size).toBe(expected.length);
    for (const name of expected) expect(existsSync(join(LABEL_PHOTOS_DIR, name)), name).toBe(true);
    expect(readdirSync(LABEL_PHOTOS_DIR).filter((name) => name.endsWith(".jpg")).sort()).toEqual(
      [...expected].sort(),
    );
    expect(preparedFileName("CHYWANPRASH_PRAN JEEVAN AVLEH - KESAR .jpg")).toBe(
      "chywanprash-pran-jeevan-avleh-kesar.jpg",
    );
  });

  it("puts the file numbered 1 first", () => {
    for (const set of photoSets) {
      const first = set.photos[0].file;
      if (/ \d+( copy( \d+)?)?\.jpg$/.test(first)) expect(first).toMatch(/ 1\.jpg$/);
    }
  });

  it("makes keys, styles and descriptions from names", () => {
    expect(photoVariantKey("Royal Blue")).toBe("royal-blue");
    expect(photoVariantKey("Green & cream")).toBe("green-and-cream");
    expect(photoVariantStyle("Dark Green")).toBe("classic-green");
    expect(photoVariantStyle("Gold")).toBe("saffron-glow");
    expect(photoVariantStyle("Wine")).toBe("royal-maroon");
    expect(photoVariantStyle("Navy Blue")).toBe("minimal-white");
    for (const set of photoSets) {
      for (const photo of set.photos) {
        expect(brandThemeKeys).toContain(photoVariantStyle(photo.name));
        expect(photoAlt(set.products[0], photo.name).length).toBeLessThanOrEqual(200);
      }
    }
  });
});
