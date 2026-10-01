import { describe, expect, it } from "vitest";
import { detectFileType } from "@/server/storage/files";
import { catalogueHref, slugify } from "./catalogue";
import { formatPaise, paiseToRupeeInput, rupeesToPaise } from "./format";

describe("money in paise", () => {
  it("formats with Indian grouping, showing paise only when there are some", () => {
    expect(formatPaise(125_000)).toBe("₹1,250");
    expect(formatPaise(12_500_000)).toBe("₹1,25,000");
    expect(formatPaise(125_050)).toBe("₹1,250.50");
    expect(formatPaise(5)).toBe("₹0.05");
  });

  it("reads rupee amounts typed into a form", () => {
    expect(rupeesToPaise("1,250")).toBe(125_000);
    expect(rupeesToPaise("₹ 1250.5")).toBe(125_050);
    expect(rupeesToPaise("0.05")).toBe(5);
    for (const bad of ["", "12.345", "-5", "1e3", "abc", "1.2.3"]) {
      expect(rupeesToPaise(bad)).toBeNull();
    }
  });

  it("writes paise back as a plain amount", () => {
    expect(paiseToRupeeInput(125_000)).toBe("1250");
    expect(paiseToRupeeInput(125_050)).toBe("1250.50");
  });
});

describe("catalogue links", () => {
  it("makes slugs from names", () => {
    expect(slugify("Punarnava Mandoor (60 tabs)")).toBe("punarnava-mandoor-60-tabs");
    expect(slugify("Taila & Ghrita")).toBe("taila-and-ghrita");
    expect(slugify("  Āsava–Arishta ")).toBe("asava-arishta");
    expect(slugify("चूर्ण")).toBe("");
  });

  it("builds listing links without empty filters", () => {
    expect(catalogueHref()).toBe("/products");
    expect(catalogueHref({ brand: "flowgra", form: undefined, q: "joint care" })).toBe(
      "/products?brand=flowgra&q=joint+care",
    );
  });
});

describe("detectFileType", () => {
  it("recognises WebP by both of its markers", () => {
    const webp = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
    expect(detectFileType(new Uint8Array(webp))).toBe("image/webp");
    // A RIFF file that isn't WebP (e.g. a WAV).
    const wav = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45];
    expect(detectFileType(new Uint8Array(wav))).toBeNull();
  });
});
