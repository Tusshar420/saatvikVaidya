import type { Prisma } from "@/generated/prisma/client";

/**
 * The account types from docs/PLAN.md. Customer comes first at sign-up.
 * `bulkPricing`: approved Pharmacy / Store and Stockist / Distributor accounts
 * also get bulk price tiers (docs/CHUNKS.md, P1.3).
 */
export const userTypeSeed = [
  {
    key: "customer",
    label: "Customer",
    isProfessional: false,
    requiresVerification: false,
    bulkPricing: false,
    sortOrder: 10,
  },
  {
    key: "doctor",
    bulkPricing: false,
    label: "Ayurveda Doctor",
    isProfessional: true,
    requiresVerification: true,
    sortOrder: 20,
  },
  {
    key: "clinic",
    bulkPricing: false,
    label: "Clinic / Hospital",
    isProfessional: true,
    requiresVerification: true,
    sortOrder: 30,
  },
  {
    key: "pharmacy",
    bulkPricing: true,
    label: "Pharmacy / Store",
    isProfessional: true,
    requiresVerification: true,
    sortOrder: 40,
  },
  {
    key: "stockist",
    bulkPricing: true,
    label: "Stockist / Distributor",
    isProfessional: true,
    requiresVerification: true,
    sortOrder: 50,
  },
] satisfies Prisma.UserTypeCreateInput[];
