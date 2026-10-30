import type { ShipmentStatusKey } from "@/lib/shipping";

// The shipping provider interface (docs/CHUNKS.md, P1.5). The admin panel
// and tracking talk only to this, so Shiprocket can replace the test
// provider later without changes to them: it would book a courier in
// createShipment() and check its webhook in verifyEvent().

export type ShippingProviderName = "test" | "manual";

export type CreateShipmentInput = {
  orderId: string;
  orderNumber: string;
  /** Where the parcel goes (the order's address snapshot). */
  city: string;
  state: string;
  pincode: string;
  /** Units in the parcel. */
  units: number;
  /** Typed by the admin when the team booked the courier themselves (manual provider). */
  courierName?: string | null;
  trackingNumber?: string | null;
};

/** A status change the provider reported for a shipment, once checked. */
export type ShipmentUpdate = {
  awb: string;
  status: ShipmentStatusKey;
  /** Where it happened, e.g. "Pune hub". */
  location?: string | null;
  note?: string | null;
};

export interface ShippingProvider {
  readonly name: ShippingProviderName;
  /** False when the provider must not run here (see the test provider). */
  isAvailable(): boolean;
  /** Books the parcel; returns the courier and its tracking (AWB) number. */
  createShipment(input: CreateShipmentInput): Promise<{ courierName: string; awb: string }>;
  /** Calls off a parcel that hasn't left yet. */
  cancelShipment(awb: string): Promise<void>;
  /**
   * Checks a status update (a webhook payload, or the test provider's
   * simulated step) and turns it into a ShipmentUpdate. Throws if the
   * payload isn't valid for this provider.
   */
  verifyEvent(payload: unknown): Promise<ShipmentUpdate>;
}

/** Thrown when a provider refuses to run (e.g. the test provider in production). */
export class ShippingProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShippingProviderUnavailableError";
  }
}
