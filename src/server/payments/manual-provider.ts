import { randomBytes } from "node:crypto";
import type { PaymentProvider } from "./types";

// PAYMENT_PROVIDER=manual: the launch way to take money. The customer places
// the order, then pays by UPI QR code or bank transfer, using the details
// from the "payment.manual" setting. Nothing here talks to a bank: the
// payment stays "created" (the order "pending_payment") until an admin
// checks the money arrived and marks it paid (markOrderPaid in
// src/server/admin/orders.ts, which uses the same completePayment() as every
// provider). Razorpay can replace this later without changing checkout.

export const manualPaymentProvider: PaymentProvider = {
  name: "manual",
  isAvailable: () => true,
  async createPayment() {
    return { reference: `manual_${randomBytes(12).toString("hex")}` };
  },
  async verifyPayment() {
    // The browser can't report a result: only an admin marks it paid.
    throw new Error("Manual payments are confirmed by an admin, not by the customer's browser.");
  },
  async refundPayment() {
    // Money is returned by hand (bank transfer); only a reference is kept.
    return { reference: `manual_refund_${randomBytes(12).toString("hex")}` };
  },
};
