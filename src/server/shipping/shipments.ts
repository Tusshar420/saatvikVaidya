import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { isOrderId } from "@/lib/orders";
import {
  canMoveShipment,
  nextShipmentStep,
  orderStatusForShipment,
  type ShipmentStatusKey,
} from "@/lib/shipping";
import { logAdminAction } from "@/server/admin/audit";
import { earnForOrder } from "@/server/coins/ledger";
import { db } from "@/server/db";
import { sendShipmentUpdate } from "@/server/notify/orders";
import { getShippingProvider, simulatedEvent, type ShipmentUpdate } from "./index";

// Shipments (docs/CHUNKS.md, P1.5), whatever the provider. Each step is
// applied at most once: the shipment only moves on from the step it was at
// with a conditional update, so a double click, a replayed webhook or two
// admins at once record one event and send one message.
//
// Every step writes a ShipmentEvent, moves the order's status to match
// (src/lib/shipping.ts) and sends the buyer a dev-log message.

export type ShipmentError = "not_found" | "not_paid" | "exists" | "not_allowed" | "shipping_off";

export type ShipmentResult =
  | { ok: true; changed: boolean; status: ShipmentStatusKey }
  | { ok: false; error: ShipmentError };

function isUniqueClash(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

async function notify(orderId: string, status: ShipmentStatusKey): Promise<void> {
  try {
    await sendShipmentUpdate(orderId, status);
  } catch (error) {
    console.error("shipments: update message not sent.", error);
  }
}

/** Order statuses a shipment step may overwrite (never cancelled or unpaid ones). */
const shippableOrderStatuses = ["paid", "processing", "shipped"] as const;

/**
 * "Create shipment" on a paid order: books it with the provider (a fake
 * courier and AWB for the test provider), records the first step and marks
 * the order as being prepared. One shipment per order.
 */
export async function createShipment(actorId: string, orderId: string): Promise<ShipmentResult> {
  if (!isOrderId(orderId)) return { ok: false, error: "not_found" };
  const provider = getShippingProvider();
  if (!provider.isAvailable()) return { ok: false, error: "shipping_off" };
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      status: true,
      shipCity: true,
      shipState: true,
      shipPincode: true,
      shipment: { select: { status: true } },
      items: { select: { quantity: true } },
    },
  });
  if (!order) return { ok: false, error: "not_found" };
  if (order.shipment) return { ok: false, error: "exists" };
  if (order.status !== "paid") return { ok: false, error: "not_paid" };

  const booked = await provider.createShipment({
    orderId: order.id,
    orderNumber: order.number,
    city: order.shipCity,
    state: order.shipState,
    pincode: order.shipPincode,
    units: order.items.reduce((sum, item) => sum + item.quantity, 0),
  });
  try {
    await db.$transaction(async (tx) => {
      // Only a paid order: if it was cancelled meanwhile, nothing is created.
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: "paid" },
        data: { status: "processing" },
      });
      if (moved.count === 0) throw new NotPaid();
      const shipment = await tx.shipment.create({
        data: {
          orderId: order.id,
          provider: provider.name,
          courierName: booked.courierName,
          awb: booked.awb,
          events: {
            create: {
              status: "created",
              location: simulatedEvent(booked.awb, "created", order.shipCity).location,
              actorId,
            },
          },
        },
        select: { id: true },
      });
      await logAdminAction(tx, {
        actorId,
        action: "shipment.create",
        resource: "Order",
        resourceId: order.id,
        changes: {
          courier: { from: null, to: booked.courierName },
          awb: { from: null, to: booked.awb },
          shipmentId: { from: null, to: shipment.id },
        },
      });
    });
  } catch (error) {
    // Two clicks at once: the other one created it. Call off this booking.
    const clash = isUniqueClash(error);
    if (clash || error instanceof NotPaid) {
      await provider.cancelShipment(booked.awb).catch((cancelError: unknown) => {
        console.error("createShipment: spare booking not cancelled.", cancelError);
      });
      return clash
        ? { ok: true, changed: false, status: "created" }
        : { ok: false, error: "not_paid" };
    }
    throw error;
  }
  await notify(order.id, "created");
  return { ok: true, changed: true, status: "created" };
}

class NotPaid extends Error {}

/**
 * Applies a checked provider update (a webhook, or a simulated step) to its
 * shipment. A step that isn't allowed from where the shipment is now (or
 * was already applied) changes nothing.
 */
export async function recordShipmentEvent(
  update: ShipmentUpdate,
  actorId: string | null = null,
): Promise<ShipmentResult> {
  const shipment = await db.shipment.findUnique({
    where: { awb: update.awb },
    select: { id: true, orderId: true, status: true },
  });
  if (!shipment) return { ok: false, error: "not_found" };
  if (shipment.status === update.status) {
    return { ok: true, changed: false, status: shipment.status };
  }
  if (update.status === "cancelled" || !canMoveShipment(shipment.status, update.status)) {
    return { ok: false, error: "not_allowed" };
  }

  const changed = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const claimed = await tx.shipment.updateMany({
      where: { id: shipment.id, status: shipment.status },
      data: { status: update.status },
    });
    if (claimed.count === 0) return false;
    await tx.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        status: update.status,
        location: update.location?.slice(0, 100) ?? null,
        note: update.note?.slice(0, 200) ?? null,
        actorId,
      },
    });
    await tx.order.updateMany({
      where: { id: shipment.orderId, status: { in: [...shippableOrderStatuses] } },
      data: { status: orderStatusForShipment(update.status) },
    });
    if (actorId) {
      await logAdminAction(tx, {
        actorId,
        action: "shipment.update",
        resource: "Order",
        resourceId: shipment.orderId,
        changes: { shipment: { from: shipment.status, to: update.status } },
      });
    }
    return true;
  });
  if (!changed) {
    const now = await db.shipment.findUniqueOrThrow({
      where: { id: shipment.id },
      select: { status: true },
    });
    return { ok: true, changed: false, status: now.status };
  }
  await notify(shipment.orderId, update.status);
  if (update.status === "delivered") {
    await earnForOrder(shipment.orderId, "delivered").catch((error: unknown) => {
      console.error("recordShipmentEvent: coins not credited.", error);
    });
  }
  return { ok: true, changed: true, status: update.status };
}

export type SimulatedStep = "next" | "undelivered" | "returned";

/**
 * The admin's "Simulate next step" (or "Mark undelivered" / "Mark
 * returned"): asks the provider for the step and records it. `from` is the
 * step the admin saw, so a double click doesn't skip a step.
 */
export async function simulateShipmentStep(
  actorId: string,
  orderId: string,
  step: SimulatedStep,
  from: ShipmentStatusKey,
): Promise<ShipmentResult> {
  if (!isOrderId(orderId)) return { ok: false, error: "not_found" };
  const provider = getShippingProvider();
  if (!provider.isAvailable()) return { ok: false, error: "shipping_off" };
  const shipment = await db.shipment.findUnique({
    where: { orderId },
    select: { awb: true, status: true, order: { select: { shipCity: true } } },
  });
  if (!shipment) return { ok: false, error: "not_found" };
  // Already moved on from what the admin saw (a double click): nothing to do.
  if (shipment.status !== from) return { ok: true, changed: false, status: shipment.status };

  const to = step === "next" ? nextShipmentStep(shipment.status) : step;
  if (!to || !canMoveShipment(shipment.status, to)) return { ok: false, error: "not_allowed" };
  const update = await provider.verifyEvent(simulatedEvent(shipment.awb, to, shipment.order.shipCity));
  return recordShipmentEvent(update, actorId);
}
