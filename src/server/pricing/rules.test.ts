import { describe, expect, it } from "vitest";
import { userTypeSeed } from "@/server/seed/user-types";
import {
  basePriceColumn,
  guestViewer,
  priceFor,
  pricingViewerFor,
  type PricingUser,
  type PricingViewer,
} from "./rules";

// The pricing rules from docs/CHUNKS.md (P1.3), checked against the seeded
// user types so a change to the seed can't quietly change who pays what.

const product = {
  mrpPaise: 32_000,
  professionalPricePaise: 24_000,
  bulkTiers: [
    { minQuantity: 50, pricePaise: 21_000 },
    { minQuantity: 10, pricePaise: 22_500 },
  ],
};

const statuses = ["none", "pending", "approved", "rejected"] as const;

function userOf(key: string, verificationStatus: PricingUser["verificationStatus"]): PricingUser {
  const type = userTypeSeed.find((t) => t.key === key);
  if (!type) throw new Error(`No seeded user type ${key}`);
  return { verificationStatus, userType: type };
}

describe("pricingViewerFor", () => {
  it("gives guests and customers MRP, whatever the status says", () => {
    expect(pricingViewerFor(null)).toEqual(guestViewer);
    for (const status of statuses) {
      expect(pricingViewerFor(userOf("customer", status))).toEqual({
        kind: "customer",
        professional: false,
        bulk: false,
      });
    }
  });

  it.each(["doctor", "clinic", "pharmacy", "stockist"])(
    "prices an unapproved %s like a customer",
    (key) => {
      for (const status of ["none", "pending", "rejected"] as const) {
        expect(pricingViewerFor(userOf(key, status))).toEqual({
          kind: "unverifiedProfessional",
          professional: false,
          bulk: false,
        });
      }
    },
  );

  it("gives approved doctors and clinics the professional price only", () => {
    for (const key of ["doctor", "clinic"]) {
      expect(pricingViewerFor(userOf(key, "approved"))).toEqual({
        kind: "professional",
        professional: true,
        bulk: false,
      });
    }
  });

  it("gives approved pharmacies and stockists bulk tiers too", () => {
    for (const key of ["pharmacy", "stockist"]) {
      expect(pricingViewerFor(userOf(key, "approved"))).toEqual({
        kind: "professional",
        professional: true,
        bulk: true,
      });
    }
  });

  it("follows the user type's data for a new professional type", () => {
    const noCheck = {
      verificationStatus: "none" as const,
      userType: { isProfessional: true, requiresVerification: false, bulkPricing: true },
    };
    expect(pricingViewerFor(noCheck)).toMatchObject({ professional: true, bulk: true });
  });
});

describe("priceFor", () => {
  const doctor = pricingViewerFor(userOf("doctor", "approved"));
  const pharmacy = pricingViewerFor(userOf("pharmacy", "approved"));
  const pendingPharmacy = pricingViewerFor(userOf("pharmacy", "pending"));

  it("charges MRP to everyone without professional prices, at any quantity", () => {
    for (const viewer of [guestViewer, pendingPharmacy]) {
      expect(priceFor(product, viewer, 100)).toEqual({
        unitPaise: 32_000,
        totalPaise: 3_200_000,
        mrpPaise: 32_000,
        tier: "mrp",
        savingPaise: 0,
        discountPercent: 0,
        bulkTiers: [],
      });
    }
  });

  it("charges an approved doctor the professional price, never bulk", () => {
    const price = priceFor(product, doctor, 60);
    expect(price).toMatchObject({ unitPaise: 24_000, tier: "professional", savingPaise: 8_000 });
    expect(price.bulkTiers).toEqual([]);
  });

  it("applies the best bulk tier an approved pharmacy has reached", () => {
    expect(priceFor(product, pharmacy, 9)).toMatchObject({ unitPaise: 24_000, tier: "professional" });
    expect(priceFor(product, pharmacy, 10)).toMatchObject({ unitPaise: 22_500, tier: "bulk" });
    expect(priceFor(product, pharmacy, 49).unitPaise).toBe(22_500);
    expect(priceFor(product, pharmacy, 50)).toMatchObject({
      unitPaise: 21_000,
      totalPaise: 1_050_000,
      tier: "bulk",
    });
    // Tiers come back in quantity order for display.
    expect(priceFor(product, pharmacy).bulkTiers.map((t) => t.minQuantity)).toEqual([10, 50]);
  });

  it("never charges more than MRP, and ignores tiers that aren't cheaper", () => {
    const odd = {
      mrpPaise: 10_000,
      professionalPricePaise: 12_000,
      bulkTiers: [
        { minQuantity: 5, pricePaise: 11_000 },
        { minQuantity: 1, pricePaise: 1 },
      ],
    };
    expect(priceFor(odd, pharmacy, 20)).toMatchObject({
      unitPaise: 10_000,
      tier: "mrp",
      bulkTiers: [],
    });
  });

  it("refuses quantities that aren't whole numbers from 1", () => {
    for (const quantity of [0, -1, 1.5, Number.NaN]) {
      expect(() => priceFor(product, doctor, quantity)).toThrow(RangeError);
    }
  });

  it("sorts by the column that matches the viewer's base price", () => {
    const viewers: [PricingViewer, string][] = [
      [guestViewer, "mrpPaise"],
      [pendingPharmacy, "mrpPaise"],
      [doctor, "professionalPricePaise"],
      [pharmacy, "professionalPricePaise"],
    ];
    for (const [viewer, column] of viewers) expect(basePriceColumn(viewer)).toBe(column);
  });
});

describe("site-wide discount", () => {
  const pharmacy: PricingViewer = { kind: "professional", professional: true, bulk: true };
  const doctor: PricingViewer = { kind: "professional", professional: true, bulk: false };

  it("takes the percentage off the retail price and keeps MRP as the old price", () => {
    const price = priceFor(product, guestViewer, 2, 20);
    expect(price).toMatchObject({
      unitPaise: 25_600,
      totalPaise: 51_200,
      mrpPaise: 32_000,
      savingPaise: 6_400,
      discountPercent: 20,
      tier: "mrp",
    });
  });

  it("applies to professional and bulk prices too", () => {
    expect(priceFor(product, doctor, 1, 20).unitPaise).toBe(19_200);
    const bulk = priceFor(product, pharmacy, 10, 20);
    expect(bulk.unitPaise).toBe(18_000);
    expect(bulk.tier).toBe("bulk");
    expect(bulk.bulkTiers.map((t) => t.pricePaise)).toEqual([18_000, 16_800]);
  });

  it("changes nothing at 0 and ignores nonsense values", () => {
    expect(priceFor(product, guestViewer).unitPaise).toBe(32_000);
    expect(priceFor(product, guestViewer, 1, 0).discountPercent).toBe(0);
    expect(priceFor(product, guestViewer, 1, Number.NaN).unitPaise).toBe(32_000);
    expect(priceFor(product, guestViewer, 1, -5).unitPaise).toBe(32_000);
  });
});
