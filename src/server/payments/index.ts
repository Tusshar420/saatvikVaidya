import "server-only";
import { z } from "zod";
import { manualPaymentProvider } from "./manual-provider";
import { requestPaymentProvider } from "./request-provider";
import { testPaymentProvider } from "./test-provider";
import type { PaymentProvider } from "./types";

export * from "./types";
export { testPaymentsAllowed } from "./test-provider";

// Picks the payment provider from PAYMENT_PROVIDER (read at call time, so
// tests can change it). "test" simulates payments for development; "request" is the launch way until Razorpay (no payment details shown; the team calls the customer; an admin marks it paid); "manual" shows a QR code and bank details.

const providerSchema = z.enum(["test", "manual", "request"]).default("test");

const providers: Record<z.infer<typeof providerSchema>, PaymentProvider> = {
  test: testPaymentProvider,
  manual: manualPaymentProvider,
  request: requestPaymentProvider,
};

export function getPaymentProvider(env: Partial<Record<string, string>> = process.env): PaymentProvider {
  const parsed = providerSchema.safeParse(env.PAYMENT_PROVIDER || undefined);
  if (!parsed.success) {
    throw new Error(`Unknown PAYMENT_PROVIDER "${env.PAYMENT_PROVIDER}". Use "test", "manual" or "request".`);
  }
  return providers[parsed.data];
}

/**
 * The provider that took a payment, from the name stored on it (Payment.provider).
 * Use this, not getPaymentProvider(), for anything done to an existing
 * payment (e.g. a refund), so switching PAYMENT_PROVIDER later doesn't send
 * an older payment to the wrong provider.
 */
export function getPaymentProviderByName(name: string): PaymentProvider {
  const parsed = providerSchema.unwrap().safeParse(name);
  if (!parsed.success) throw new Error(`Unknown payment provider "${name}" on a payment.`);
  return providers[parsed.data];
}

/** True when online payment can be taken right now (checkout shows "coming soon" otherwise). */
export function paymentsAvailable(): boolean {
  return getPaymentProvider().isAvailable();
}
