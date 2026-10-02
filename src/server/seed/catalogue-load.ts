import {
  areaWords,
  catalogueRows,
  hiddenNames,
  unitLabels,
} from "./catalogue-list";

/** A product ready to save, apart from brand, form and area ids. */
export type BuiltProduct = {
  slug: string;
  name: string;
  formKey: string;
  areaKeys: string[];
  description: string;
  packSize: string;
  mrpPaise: number;
  professionalPricePaise: number;
  stock: number;
  moq: number;
  active: boolean;
  sortOrder: number;
  brandEligible: true;
  brandMinQty: number;
  brandUnitPricePaise: number;
  brandUnitLabel: string;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Turns the client's sheet rows into products (pure, so it is testable). */
export function buildProducts(): BuiltProduct[] {
  return catalogueRows.map(
    ([formKey, name, packSize, mrp, price, minOrder, uses], index) => {
      const text = uses.toLowerCase();
      const areaKeys = Object.entries(areaWords)
        .filter(([, words]) => words.some((word) => text.includes(word)))
        .map(([key]) => key);
      return {
        slug: slugify(`${name} ${packSize}`),
        name,
        formKey,
        areaKeys,
        description: uses
          ? `Traditionally used for: ${uses}.`
          : "Details to be added.",
        packSize,
        mrpPaise: mrp * 100,
        professionalPricePaise: price * 100,
        stock: 0,
        moq: 1,
        active: !hiddenNames.includes(name),
        sortOrder: 1000 + index * 10,
        brandEligible: true,
        brandMinQty: minOrder,
        brandUnitPricePaise: price * 100,
        brandUnitLabel: unitLabels[formKey] ?? "units",
      };
    },
  );
}
