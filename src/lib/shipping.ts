// Shipment steps and the rules for moving between them (docs/CHUNKS.md,
// P1.5), shared by the server (src/server/shipping) and the pages that show
// tracking. Kept free of server imports so client components can use it.

export const shipmentStatuses = [
  "created",
  "packed",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "undelivered",
  "returned",
  "cancelled",
] as const;

export type ShipmentStatusKey = (typeof shipmentStatuses)[number];

/**
 * Where a shipment may go from each step. "cancelled" is only reached by
 * cancelling the order (src/server/admin/orders.ts), never as an event.
 */
export const shipmentTransitions: Record<ShipmentStatusKey, readonly ShipmentStatusKey[]> = {
  created: ["packed"],
  packed: ["shipped"],
  shipped: ["in_transit", "returned"],
  in_transit: ["out_for_delivery", "returned"],
  out_for_delivery: ["delivered", "undelivered"],
  undelivered: ["out_for_delivery", "returned"],
  delivered: [],
  returned: [],
  cancelled: [],
};

export function canMoveShipment(from: ShipmentStatusKey, to: ShipmentStatusKey): boolean {
  return shipmentTransitions[from].includes(to);
}

/**
 * The next step on the way to delivery ("Simulate next step"), or null once
 * the shipment has finished. After a failed attempt it goes out again.
 */
export function nextShipmentStep(status: ShipmentStatusKey): ShipmentStatusKey | null {
  return shipmentTransitions[status][0] ?? null;
}

/** Shipment steps that end it: nothing can follow. */
export function isFinalShipmentStatus(status: ShipmentStatusKey): boolean {
  return shipmentTransitions[status].length === 0;
}

/** The order status that goes with each shipment step. */
export function orderStatusForShipment(
  status: ShipmentStatusKey,
): "processing" | "shipped" | "delivered" | "returned" | "cancelled" {
  switch (status) {
    case "created":
    case "packed":
      return "processing";
    case "shipped":
    case "in_transit":
    case "out_for_delivery":
    case "undelivered":
      return "shipped";
    case "delivered":
      return "delivered";
    case "returned":
      return "returned";
    case "cancelled":
      return "cancelled";
  }
}

/** The steps a customer sees on the tracking timeline, in order. */
export const trackingSteps = [
  "confirmed",
  "packed",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
] as const;

export type TrackingStepKey = (typeof trackingSteps)[number];

/**
 * How far along the timeline an order is: the index of the step happening
 * now (earlier steps are done; `trackingSteps.length` means delivered), or
 * null when the timeline doesn't apply (not paid, cancelled or returned).
 */
export function trackingCurrent(
  orderStatus: string,
  shipmentStatus: ShipmentStatusKey | null,
): number | null {
  if (!["paid", "processing", "shipped", "delivered"].includes(orderStatus)) return null;
  switch (shipmentStatus) {
    case null:
    case "created":
      return 1;
    case "packed":
      return 2;
    case "shipped":
      return 3;
    case "in_transit":
      return 4;
    case "out_for_delivery":
    case "undelivered":
      return 5;
    case "delivered":
      return trackingSteps.length;
    case "returned":
    case "cancelled":
      return null;
  }
}
