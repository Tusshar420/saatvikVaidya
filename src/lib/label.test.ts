import { describe, expect, it } from "vitest";
import {
  DEFAULT_LABEL_SPEC,
  defaultLabelValues,
  effectiveLabelValues,
  fitLabelText,
  labelProblems,
  overridesFor,
  specFields,
  tidyLabelText,
  type LabelProfile,
  type LabelSpecData,
} from "./label";

const profile: LabelProfile = {
  brandName: "Vaidya Care",
  tagline: "Rooted in classics",
  shortDescription: "Classical Ayurveda, made simple.",
  longDescription:
    "Classical Ayurvedic formulations made to traditional recipes, tested for quality and packed with care for everyday wellness at home.",
  marketedByName: "Vaidya Care LLP",
  marketedByAddress: "12 MG Road\nPune 411001",
  contactPhone: "+91 92203 58400",
  licenceNumbers: "Lic. No. AYU/2024/118",
};
const product = { ingredients: "Haritaki, Bibhitaki, Amalaki", dosage: "1 tsp twice a day with warm water." };

const tube: LabelSpecData = {
  key: "tube",
  name: "Tube",
  widthMm: 90,
  heightMm: 40,
  logo: { widthMm: 20, heightMm: 12, placement: "top-left" },
  descriptionSource: "short",
  limits: { brandName: 40, tagline: 50, description: 90, contactPhone: 20 },
};
const bottle: LabelSpecData = {
  key: "bottle",
  name: "Bottle",
  widthMm: 100,
  heightMm: 60,
  logo: { widthMm: 30, heightMm: 20, placement: "top-center" },
  descriptionSource: "long",
  limits: { brandName: 60, tagline: 80, description: 250, ingredients: 200, usage: 150, marketedByAddress: 160 },
};

describe("fitLabelText", () => {
  it("leaves text that fits, and cuts the rest at a word", () => {
    expect(fitLabelText("Short", 10)).toEqual({ text: "Short", trimmed: false });
    const cut = fitLabelText("Classical Ayurvedic formulations made with care", 30);
    expect(cut.trimmed).toBe(true);
    expect(cut.text.length).toBeLessThanOrEqual(30);
    expect(cut.text.endsWith("…")).toBe(true);
    expect(cut.text).toBe("Classical Ayurvedic…");
  });

  it("cuts a single long word rather than nothing", () => {
    const cut = fitLabelText("x".repeat(50), 10);
    expect(cut.text).toBe(`${"x".repeat(9)}…`);
  });

  it("tidies spaces and line breaks", () => {
    expect(tidyLabelText("  a   b \r\n  c  ")).toBe("a b\nc");
  });
});

describe("default label values", () => {
  it("uses the short description on a tube and only the fields it prints", () => {
    const { values, trimmed } = defaultLabelValues(profile, product, tube);
    expect(specFields(tube)).toEqual(["brandName", "tagline", "description", "contactPhone"]);
    expect(values).toEqual({
      brandName: "Vaidya Care",
      tagline: "Rooted in classics",
      description: "Classical Ayurveda, made simple.",
      contactPhone: "+91 92203 58400",
    });
    expect(trimmed).toEqual([]);
    expect(values.ingredients).toBeUndefined();
  });

  it("uses the long description, the product's ingredients and usage on a bottle", () => {
    const { values } = defaultLabelValues(profile, product, bottle);
    expect(values.description).toBe(profile.longDescription);
    expect(values.ingredients).toBe("Haritaki, Bibhitaki, Amalaki");
    expect(values.usage).toBe("1 tsp twice a day with warm water.");
    expect(values.marketedByAddress).toBe("12 MG Road\nPune 411001");
  });

  it("falls back to the other description when one is blank, and shortens text that is too long", () => {
    const noShort = defaultLabelValues({ ...profile, shortDescription: null }, product, tube);
    expect(noShort.values.description?.length).toBeLessThanOrEqual(90);
    expect(noShort.trimmed).toEqual(["description"]);
    expect(noShort.values.description?.endsWith("…")).toBe(true);
    const noLong = defaultLabelValues({ ...profile, longDescription: null }, product, bottle);
    expect(noLong.values.description).toBe(profile.shortDescription);
  });

  it("has a general spec for products without one", () => {
    const { values } = defaultLabelValues(profile, product, DEFAULT_LABEL_SPEC);
    expect(values.brandName).toBe("Vaidya Care");
    expect(values.ingredients).toBeUndefined();
  });
});

describe("overrides and problems", () => {
  const { values: defaults } = defaultLabelValues(profile, product, tube);

  it("keeps only what differs from the brand", () => {
    const typed = { ...defaults, tagline: "New line", description: defaults.description };
    const overrides = overridesFor(typed, defaults, tube);
    expect(overrides).toEqual({ tagline: "New line" });
    expect(effectiveLabelValues(defaults, overrides, tube).tagline).toBe("New line");
    expect(effectiveLabelValues(defaults, overrides, tube).brandName).toBe("Vaidya Care");
    // Typing the default back removes the override.
    expect(overridesFor({ ...defaults }, defaults, tube)).toEqual({});
    // Fields the pack doesn't print are ignored.
    expect(overridesFor({ ...defaults, ingredients: "x" }, defaults, tube)).toEqual({});
  });

  it("reports text over a limit and a blank brand name", () => {
    expect(labelProblems(defaults, tube)).toEqual([]);
    const long = { ...defaults, description: "x".repeat(91), brandName: "" };
    expect(labelProblems(long, tube)).toEqual([
      { field: "brandName", length: 0, limit: 40 },
      { field: "description", length: 91, limit: 90 },
    ]);
  });
});
