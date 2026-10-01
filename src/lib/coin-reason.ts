import { coins as copy } from "@/content/coins";
import type { CoinReason } from "@/generated/prisma/client";

/** The words for a ledger row: "Used on order SV-…", "Profile reward…". */
export function coinReasonText(entry: {
  reason: CoinReason;
  reference: string | null;
  note: string | null;
  orderNumber: string | null;
}): string {
  const reasons = copy.history.reason;
  switch (entry.reason) {
    case "earn_profile":
      return reasons.earn_profile(entry.reference);
    case "admin_adjust":
      return reasons.admin_adjust(entry.note);
    default:
      return reasons[entry.reason](entry.orderNumber);
  }
}
