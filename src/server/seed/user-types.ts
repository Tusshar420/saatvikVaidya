import type { Prisma } from "@/generated/prisma/client";

/** The account types from docs/PLAN.md. Customer comes first at sign-up. */
export const userTypeSeed = [
  {
    key: "customer",
    label: "Customer",
    isProfessional: false,
    requiresVerification: false,
    sortOrder: 10,
  },
  {
    key: "doctor",
    label: "Ayurveda Doctor",
    isProfessional: true,
    requiresVerification: true,
    sortOrder: 20,
  },
  {
    key: "clinic",
    label: "Clinic / Hospital",
    isProfessional: true,
    requiresVerification: true,
    sortOrder: 30,
  },
  {
    key: "pharmacy",
    label: "Pharmacy / Store",
    isProfessional: true,
    requiresVerification: true,
    sortOrder: 40,
  },
  {
    key: "stockist",
    label: "Stockist / Distributor",
    isProfessional: true,
    requiresVerification: true,
    sortOrder: 50,
  },
] satisfies Prisma.UserTypeCreateInput[];
