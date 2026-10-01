import "server-only";
import { z } from "zod";
import { testPaymentProvider } from "./test-provider";
import type { PaymentProvider } from "./types";

export * from "./types";
export { testPaymentsAllowed } from "./test-provider";

// Picks the payment provider from PAYMENT_PROVIDER (read at call time, so
// tests can change it). Only "test" exists until Razorpay is added.

const providerSchema = z.enum(["test"]).default("test");

const providers: Record<z.infer<typeof providerSchema>, PaymentProvider> = {
  test: testPaymentProvider,
};

export function getPaymentProvider(env: Partial<Record<string, string>> = process.env): PaymentProvider {
  const parsed = providerSchema.safeParse(env.PAYMENT_PROVIDER || undefined);
  if (!parsed.success) {
    throw new Error(`Unknown PAYMENT_PROVIDER "${env.PAYMENT_PROVIDER}". Use "test".`);
  }
  return providers[parsed.data];
}

/** True when online payment can be taken right now (checkout shows "coming soon" otherwise). */
export function paymentsAvailable(): boolean {
  return getPaymentProvider().isAvailable();
}
