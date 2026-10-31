import "server-only";
import { cache } from "react";
import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { guestViewer, pricingViewerFor, type PricingViewer } from "./rules";

export * from "./rules";

/**
 * The pricing viewer for this request's user. The session is read from the
 * database on every request, so an approval or a changed user type applies
 * at once. Cached per request.
 */
export const getPricingViewer = cache(async (): Promise<PricingViewer> => {
  const session = await getSession();
  if (!session) return guestViewer;
  const userType = await db.userType.findUnique({
    where: { id: session.user.userTypeId },
    select: { isProfessional: true, requiresVerification: true, bulkPricing: true },
  });
  // A user always has a type; if it's somehow gone, price them as a customer.
  if (!userType) return { kind: "customer", professional: false, bulk: false };
  return pricingViewerFor({
    verificationStatus: session.user.verificationStatus ?? "none",
    userType,
  });
});

/**
 * The pricing viewer for another user, e.g. the customer our staff prepare
 * an order for. Null if there is no such user.
 */
export async function pricingViewerForUserId(userId: string): Promise<PricingViewer | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      verificationStatus: true,
      userType: { select: { isProfessional: true, requiresVerification: true, bulkPricing: true } },
    },
  });
  if (!user) return null;
  return pricingViewerFor({ verificationStatus: user.verificationStatus, userType: user.userType });
}
