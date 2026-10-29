import { randomBytes } from "node:crypto";
import type { PaymentProvider } from "./types";

// PAYMENT_PROVIDER=request: the way to take orders until Razorpay is added.
// The customer places the order with no payment option; the site shows no
// QR code or bank details. The team calls the customer, agrees how to pay,
// and an admin marks the order paid once the money is seen (markOrderPaid,
// which uses the same completePayment() as every provider). Nothing here
// talks to a bank. Razorpay can replace this later without changing checkout.

export const requestPaymentProvider: PaymentProvider = {
  name: "request",
  isAvailable: () => true,
  async createPayment() {
    return { reference: `request_${randomBytes(12).toString("hex")}` };
  },
  async verifyPayment() {
    // The browser can't report a result: only an admin marks it paid.
    throw new Error("Requested orders are confirmed by an admin, not by the customer's browser.");
  },
  async refundPayment() {
    // Money is returned by hand; only a reference is kept.
    return { reference: `request_refund_${randomBytes(12).toString("hex")}` };
  },
};
