// The one place that decides which price someone pays (docs/CHUNKS.md,
// P1.3). Every page that shows a price and, from P1.4, every cart and
// checkout total goes through priceFor(); nothing else reads a product's
// professional price or bulk tiers.
//
// - Signed out, customers and professionals not yet approved: MRP.
// - Approved professionals (Doctor, Clinic / Hospital): professional price.
// - Approved professionals whose type has bulkPricing (Pharmacy / Store,
//   Stockist / Distributor): professional price plus bulk tiers.
//
// Pure functions with no database access, so the rules are easy to test.

/** Which of a product's prices apply to someone. */
export type PricingViewer = {
  kind: "guest" | "customer" | "unverifiedProfessional" | "professional";
  /** Professional prices apply. */
  professional: boolean;
  /** Bulk tiers apply too. */
  bulk: boolean;
};

/** What decides the viewer: their role, verification and user type. */
export type PricingUser = {
  verificationStatus: "none" | "pending" | "approved" | "rejected";
  userType: {
    isProfessional: boolean;
    requiresVerification: boolean;
    bulkPricing: boolean;
  };
};

export const guestViewer: PricingViewer = {
  kind: "guest",
  professional: false,
  bulk: false,
};

/**
 * The viewer for a signed-in user, or a guest for null. A professional type
 * that needs verification gets professional prices only once approved; until
 * then the account is priced like a customer (docs/PLAN.md).
 */
export function pricingViewerFor(user: PricingUser | null): PricingViewer {
  if (!user) return guestViewer;
  const { userType } = user;
  if (!userType.isProfessional) {
    return { kind: "customer", professional: false, bulk: false };
  }
  if (userType.requiresVerification && user.verificationStatus !== "approved") {
    return { kind: "unverifiedProfessional", professional: false, bulk: false };
  }
  return { kind: "professional", professional: true, bulk: userType.bulkPricing };
}

export type BulkTier = { minQuantity: number; pricePaise: number };

/** The price fields priceFor() needs; all amounts in paise. */
export type PriceableProduct = {
  mrpPaise: number;
  professionalPricePaise: number;
  bulkTiers: readonly BulkTier[];
};

export type PriceTier = "mrp" | "professional" | "bulk";

export type ViewerPrice = {
  /** What one unit costs this viewer at this quantity, in paise. */
  unitPaise: number;
  /** unitPaise × quantity. */
  totalPaise: number;
  mrpPaise: number;
  /** Which price applied. */
  tier: PriceTier;
  /** How much less than MRP one unit is (0 at MRP). */
  savingPaise: number;
  /**
   * Bulk tiers this viewer can use, by quantity ascending. Empty unless the
   * viewer gets bulk prices, so pages can't show them to anyone else.
   */
  bulkTiers: BulkTier[];
};

/**
 * The price `viewer` pays for `quantity` units of `product`. Never more than
 * MRP, whatever the stored prices say; a bulk tier only counts when it's
 * cheaper than the professional price.
 */
export function priceFor(
  product: PriceableProduct,
  viewer: PricingViewer,
  quantity = 1,
): ViewerPrice {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new RangeError(`Quantity must be a whole number from 1: ${quantity}`);
  }
  const mrpPaise = product.mrpPaise;
  let unitPaise = mrpPaise;
  let tier: PriceTier = "mrp";
  let bulkTiers: BulkTier[] = [];

  if (viewer.professional) {
    const professional = Math.min(product.professionalPricePaise, mrpPaise);
    unitPaise = professional;
    tier = professional < mrpPaise ? "professional" : "mrp";

    if (viewer.bulk) {
      bulkTiers = product.bulkTiers
        .filter((t) => t.minQuantity > 1 && t.pricePaise < professional)
        .map((t) => ({ minQuantity: t.minQuantity, pricePaise: t.pricePaise }))
        .sort((a, b) => a.minQuantity - b.minQuantity);
      for (const t of bulkTiers) {
        if (quantity >= t.minQuantity && t.pricePaise < unitPaise) {
          unitPaise = t.pricePaise;
          tier = "bulk";
        }
      }
    }
  }

  return {
    unitPaise,
    totalPaise: unitPaise * quantity,
    mrpPaise,
    tier,
    savingPaise: mrpPaise - unitPaise,
    bulkTiers,
  };
}

/**
 * The product column that orders products by this viewer's base price
 * (quantity 1), for "price: low to high". Matches priceFor() because the
 * admin form keeps the professional price at or below MRP.
 */
export function basePriceColumn(
  viewer: PricingViewer,
): "mrpPaise" | "professionalPricePaise" {
  return viewer.professional ? "professionalPricePaise" : "mrpPaise";
}
