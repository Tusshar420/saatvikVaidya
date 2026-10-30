import type { SettingValues } from "@/content/settings";

/**
 * The UPI payment link a QR code opens in the customer's UPI app, with the
 * amount and the order number (as the payment note) filled in. Used by the
 * pay page and the "order placed" email.
 */
export function upiLink(
  details: Pick<SettingValues["payment.manual"], "upiId" | "payeeName">,
  amountPaise: number,
  orderNumber: string,
): string {
  const params = new URLSearchParams({
    pa: details.upiId,
    pn: details.payeeName,
    am: (amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: orderNumber,
  });
  return `upi://pay?${params.toString()}`;
}
