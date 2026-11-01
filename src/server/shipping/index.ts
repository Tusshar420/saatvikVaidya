import "server-only";
import { z } from "zod";
import type { ShipmentStatusKey } from "@/lib/shipping";
import { manualShippingProvider } from "./manual-provider";
import { simulatedEvent, testShippingAllowed, testShippingProvider } from "./test-provider";
import type { ShippingProvider } from "./types";

export * from "./types";
export { simulatedEvent, testShippingAllowed } from "./test-provider";

// Picks the shipping provider from SHIPPING_PROVIDER (read at call time, so
// tests can change it). "test" simulates a courier on a developer machine;
// "manual" lets the team record a courier they booked themselves. Shiprocket
// comes later.
//
// "test" can't run on a server, so there it falls back to "manual": a live
// site set up with SHIPPING_PROVIDER=test still gets working delivery steps.

const providerSchema = z.enum(["test", "manual"]).default("test");

const providers: Record<z.infer<typeof providerSchema>, ShippingProvider> = {
  test: testShippingProvider,
  manual: manualShippingProvider,
};

export function getShippingProvider(
  env: Partial<Record<string, string>> = process.env,
): ShippingProvider {
  const parsed = providerSchema.safeParse(env.SHIPPING_PROVIDER || undefined);
  if (!parsed.success) {
    throw new Error(`Unknown SHIPPING_PROVIDER "${env.SHIPPING_PROVIDER}". Use "test" or "manual".`);
  }
  if (parsed.data === "test" && !testShippingAllowed(env)) return manualShippingProvider;
  return providers[parsed.data];
}

/** True when shipments can be booked right now (the admin sees "coming soon" otherwise). */
export function shippingAvailable(): boolean {
  return getShippingProvider().isAvailable();
}

/** True when the team records the courier and every step by hand. */
export function shippingIsManual(): boolean {
  return getShippingProvider().name === "manual";
}

/**
 * The update a step sends through the provider when the admin moves a
 * shipment on: the test provider adds a made-up place; a manual step has none.
 */
export function stepEvent(
  provider: ShippingProvider,
  awb: string,
  status: ShipmentStatusKey,
  city: string,
): { awb: string; status: ShipmentStatusKey; location?: string | null } {
  return provider.name === "test" ? simulatedEvent(awb, status, city) : { awb, status };
}
