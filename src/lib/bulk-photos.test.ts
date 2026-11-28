import { describe, expect, it } from "vitest";
import {
  defaultPhotoAlt,
  photoRoomLeft,
  rowsOverLimit,
  searchPhotoProducts,
  type PhotoProduct,
} from "./bulk-photos";
import { MAX_PRODUCT_IMAGES } from "./catalogue";

const product = (id: number, name: string, extra: Partial<PhotoProduct> = {}): PhotoProduct => ({
  id,
  name,
  brand: "Saatvik",
  packSize: "60 g",
  active: true,
  brandEligible: true,
  imageCount: 0,
  variants: [],
  ...extra,
});

const products = [
  product(1, "Triphala Churna"),
  product(2, "Ashwagandha Churna", { brand: "Dabur" }),
  product(3, "Hingwastak Churna", { packSize: "100 g" }),
  product(4, "Churna Mix Triphala"),
];

describe("bulk photo upload", () => {
  it("finds products by every word of the name, brand or pack size", () => {
    const ids = (query: string) => searchPhotoProducts(query, products).map((p) => p.id);
    expect(ids("")).toEqual([1, 2, 3, 4]);
    expect(ids("  TRIPH ")).toEqual([1, 4]);
    expect(ids("churna triphala")).toEqual([1, 4]);
    expect(ids("dabur")).toEqual([2]);
    expect(ids("100 g")).toEqual([3]);
    expect(ids("guggulu")).toEqual([]);
    // Names that start with the query come first.
    expect(ids("churna")).toEqual([4, 1, 2, 3]);
    expect(searchPhotoProducts("", products, 2)).toHaveLength(2);
  });

  it("stops rows that would go past a product's photo limit", () => {
    const full = product(5, "Full", { imageCount: MAX_PRODUCT_IMAGES });
    const nearly = product(6, "Nearly", { imageCount: MAX_PRODUCT_IMAGES - 1 });
    expect(photoRoomLeft(full)).toBe(0);
    expect(photoRoomLeft(nearly)).toBe(1);
    const over = rowsOverLimit(
      [
        { id: "a", productId: 6 },
        { id: "b", productId: null },
        { id: "c", productId: 6 },
        { id: "d", productId: 5 },
        { id: "e", productId: 1 },
      ],
      [full, nearly, products[0]!],
    );
    expect([...over]).toEqual(["c", "d"]);
  });

  it("describes a photo by its product and variant", () => {
    expect(defaultPhotoAlt("Triphala Churna", "Saffron Glow")).toBe("Triphala Churna: Saffron Glow");
    expect(defaultPhotoAlt("Triphala Churna", null)).toBe("Triphala Churna");
    expect(defaultPhotoAlt("x".repeat(300), null)).toHaveLength(200);
  });
});
