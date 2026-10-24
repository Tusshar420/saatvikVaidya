import "server-only";
import { z } from "zod";
import { manualPaymentProvider } from "./manual-provider";
import { testPaymentProvider } from "./test-provider";
import type { PaymentProvider } from "./types";

export * from "./types";
export { testPaymentsAllowed } from "./test-provider";

// Picks the payment provider from PAYMENT_PROVIDER (read at call time, so
// tests can change it). "test" simulates payments for development; "manual" is the launch way (QR code or bank transfer, confirmed by an admin).

const providerSchema = z.enum(["test", "manual"]).default("test");

const providers: Record<z.infer<typeof providerSchema>, PaymentProvider> = {
  test: testPaymentProvider,
  manual: manualPaymentProvider,
};

export function getPaymentProvider(env: Partial<Record<string, string>> = process.env): PaymentProvider {
  const parsed = providerSchema.safeParse(env.PAYMENT_PROVIDER || undefined);
  if (!parsed.success) {
    throw new Error(`Unknown PAYMENT_PROVIDER "${env.PAYMENT_PROVIDER}". Use "test" or "manual".`);
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
