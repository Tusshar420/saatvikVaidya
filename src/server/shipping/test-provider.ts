import { randomInt } from "node:crypto";
import { z } from "zod";
import { shipmentStatuses, type ShipmentStatusKey } from "@/lib/shipping";
import { ShippingProviderUnavailableError, type ShippingProvider } from "./types";

// SHIPPING_PROVIDER=test: no courier is booked. "Create shipment" returns a
// made-up courier and AWB number, and the admin moves the parcel on with
// "Simulate next step"; each step arrives through verifyEvent() just as a
// Shiprocket webhook would.
//
// Like the test payment provider, it refuses to run when
// NODE_ENV=production, so fake tracking can't reach real customers. The one
// exception is the local production build that Playwright tests against:
// TEST_SHIPPING_IN_LOCAL_BUILD=true *and* a localhost BETTER_AUTH_URL.

type Env = Partial<
  Record<"NODE_ENV" | "TEST_SHIPPING_IN_LOCAL_BUILD" | "BETTER_AUTH_URL", string>
>;

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    return localHosts.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** Whether the test provider may run with this environment. Read at call time. */
export function testShippingAllowed(env: Env = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env.TEST_SHIPPING_IN_LOCAL_BUILD === "true" && isLocalOrigin(env.BETTER_AUTH_URL);
}

function assertAllowed(): void {
  if (!testShippingAllowed()) {
    throw new ShippingProviderUnavailableError(
      "The test shipping provider is disabled in production. Set SHIPPING_PROVIDER to a real provider.",
    );
  }
}

/** Made-up couriers, each with its AWB prefix. Names only; nothing is booked. */
const testCouriers = [
  { name: "Test Express (simulated)", prefix: "TE" },
  { name: "Demo Surface (simulated)", prefix: "DS" },
] as const;

/** A status update as the test provider sends it. */
export const testShipmentEventSchema = z.object({
  awb: z.string().trim().min(1).max(40),
  status: z.enum(shipmentStatuses),
  location: z.string().trim().max(100).nullish(),
  note: z.string().trim().max(200).nullish(),
});

/** Where each simulated step happens: our warehouse, a hub, then the buyer's city. */
export function simulatedLocation(status: ShipmentStatusKey, city: string): string | null {
  switch (status) {
    case "created":
    case "packed":
    case "shipped":
      return "Saatvik Vaidya warehouse";
    case "in_transit":
      return "Courier hub";
    case "out_for_delivery":
    case "delivered":
    case "undelivered":
      return city;
    case "returned":
      return "Saatvik Vaidya warehouse";
    case "cancelled":
      return null;
  }
}

/** The payload the test provider "sends" for a simulated step. */
export function simulatedEvent(awb: string, status: ShipmentStatusKey, city: string) {
  return { awb, status, location: simulatedLocation(status, city) };
}

export const testShippingProvider: ShippingProvider = {
  name: "test",
  isAvailable: () => testShippingAllowed(),
  async createShipment() {
    assertAllowed();
    const courier = testCouriers[randomInt(testCouriers.length)];
    const digits = String(randomInt(10 ** 9)).padStart(9, "0") + String(randomInt(1_000)).padStart(3, "0");
    return { courierName: courier.name, awb: `${courier.prefix}${digits}` };
  },
  async cancelShipment() {
    assertAllowed();
  },
  async verifyEvent(payload) {
    assertAllowed();
    return testShipmentEventSchema.parse(payload);
  },
};
