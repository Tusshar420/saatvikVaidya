import { z } from "zod";
import { shipmentStatuses } from "@/lib/shipping";
import { admin as copy } from "@/content/admin";
import type { ShippingProvider } from "./types";

// SHIPPING_PROVIDER=manual: no courier is booked through the site. The team
// books the parcel with any courier themselves, types its name and tracking
// number into "Create shipment" (both optional), and moves each delivery step
// on by hand. The buyer is told at every step, as with any provider. Safe on
// a live site: nothing is made up except a fallback tracking number (the
// order number) when none was typed.

/** A step as the admin records it. No location: the team didn't see one. */
export const manualShipmentEventSchema = z.object({
  awb: z.string().trim().min(1).max(40),
  status: z.enum(shipmentStatuses),
  note: z.string().trim().max(200).nullish(),
});

export const manualShippingProvider: ShippingProvider = {
  name: "manual",
  isAvailable: () => true,
  async createShipment(input) {
    return {
      courierName: input.courierName?.trim() || copy.orderDetail.manualCourierFallback,
      awb: input.trackingNumber?.trim() || input.orderNumber,
    };
  },
  async cancelShipment() {
    // Nothing was booked through the site, so there is nothing to call off.
  },
  async verifyEvent(payload) {
    return manualShipmentEventSchema.parse(payload);
  },
};
