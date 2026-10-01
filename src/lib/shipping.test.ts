import { describe, expect, it } from "vitest";
import {
  canMoveShipment,
  isFinalShipmentStatus,
  nextShipmentStep,
  orderStatusForShipment,
  shipmentStatuses,
  trackingCurrent,
  trackingSteps,
} from "./shipping";

describe("shipment steps", () => {
  it("follow the delivery path, with a failed attempt going out again", () => {
    const path = [];
    let step: (typeof shipmentStatuses)[number] | null = "created";
    while (step) {
      path.push(step);
      step = nextShipmentStep(step);
    }
    expect(path).toEqual(["created", "packed", "shipped", "in_transit", "out_for_delivery", "delivered"]);
    expect(nextShipmentStep("undelivered")).toBe("out_for_delivery");
  });

  it("allow undelivered and returned only where they make sense", () => {
    expect(canMoveShipment("out_for_delivery", "undelivered")).toBe(true);
    expect(canMoveShipment("in_transit", "undelivered")).toBe(false);
    expect(canMoveShipment("undelivered", "returned")).toBe(true);
    expect(canMoveShipment("packed", "returned")).toBe(false);
    expect(canMoveShipment("created", "delivered")).toBe(false);
    for (const status of shipmentStatuses) expect(canMoveShipment(status, "cancelled")).toBe(false);
    expect(["delivered", "returned", "cancelled"].every((s) => isFinalShipmentStatus(s as never))).toBe(true);
  });

  it("map to order statuses", () => {
    expect(orderStatusForShipment("created")).toBe("processing");
    expect(orderStatusForShipment("packed")).toBe("processing");
    expect(orderStatusForShipment("out_for_delivery")).toBe("shipped");
    expect(orderStatusForShipment("undelivered")).toBe("shipped");
    expect(orderStatusForShipment("delivered")).toBe("delivered");
    expect(orderStatusForShipment("returned")).toBe("returned");
  });

  it("place the order on the timeline", () => {
    expect(trackingCurrent("pending_payment", null)).toBeNull();
    expect(trackingCurrent("cancelled", "cancelled")).toBeNull();
    expect(trackingCurrent("returned", "returned")).toBeNull();
    expect(trackingCurrent("paid", null)).toBe(1);
    expect(trackingCurrent("processing", "packed")).toBe(2);
    expect(trackingCurrent("shipped", "undelivered")).toBe(5);
    expect(trackingCurrent("delivered", "delivered")).toBe(trackingSteps.length);
  });
});
