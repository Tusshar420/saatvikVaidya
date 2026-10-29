import "server-only";
import { z } from "zod";
import { testShippingProvider } from "./test-provider";
import type { ShippingProvider } from "./types";

export * from "./types";
export { simulatedEvent, testShippingAllowed } from "./test-provider";

// Picks the shipping provider from SHIPPING_PROVIDER (read at call time, so
// tests can change it). Only "test" exists until Shiprocket is added.

const providerSchema = z.enum(["test"]).default("test");

const providers: Record<z.infer<typeof providerSchema>, ShippingProvider> = {
  test: testShippingProvider,
};

export function getShippingProvider(
  env: Partial<Record<string, string>> = process.env,
): ShippingProvider {
  const parsed = providerSchema.safeParse(env.SHIPPING_PROVIDER || undefined);
  if (!parsed.success) {
    throw new Error(`Unknown SHIPPING_PROVIDER "${env.SHIPPING_PROVIDER}". Use "test".`);
  }
  return providers[parsed.data];
}

/** True when shipments can be booked right now (the admin sees "coming soon" otherwise). */
export function shippingAvailable(): boolean {
  return getShippingProvider().isAvailable();
}
