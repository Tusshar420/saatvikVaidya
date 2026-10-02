"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { admin as copy } from "@/content/admin";
import { orders as ordersCopy } from "@/content/orders";
import { orderIdPattern } from "@/lib/orders";
import { shipmentStatuses } from "@/lib/shipping";
import type { FormState } from "@/server/admin/form";
import { cancelOrder } from "@/server/admin/orders";
import { requireAdmin } from "@/server/auth/session";
import { ShippingProviderUnavailableError } from "@/server/shipping";
import { createShipment, simulateShipmentStep, type ShipmentResult } from "@/server/shipping/shipments";

// Server actions for /admin/orders/[id]: create the shipment, move it on
// (simulated), and cancel the order. Each checks the admin session itself,
// validates its input with Zod and returns only a message.

const text = copy.orderDetail;
const orderIdSchema = z.string().regex(orderIdPattern);

function refresh(orderId: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/orders/${orderId}`);
}

function shipmentMessage(result: ShipmentResult): FormState {
  if (!result.ok) return { status: "error", message: text.results[result.error] };
  if (!result.changed) return { status: "success", message: text.results.unchanged };
  return {
    status: "success",
    message:
      result.status === "created"
        ? text.results.created
        : text.results.moved(ordersCopy.shipmentStatus[result.status]),
  };
}

async function guarded(run: () => Promise<ShipmentResult>): Promise<FormState> {
  try {
    return shipmentMessage(await run());
  } catch (error) {
    if (error instanceof ShippingProviderUnavailableError) {
      return { status: "error", message: text.results.shipping_off };
    }
    throw error;
  }
}

export async function createShipmentAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("orders");
  const orderId = orderIdSchema.safeParse(formData.get("orderId"));
  if (!orderId.success) return { status: "error", message: text.results.not_found };
  const state = await guarded(() => createShipment(user.id, orderId.data));
  refresh(orderId.data);
  return state;
}

const stepSchema = z.object({
  orderId: orderIdSchema,
  step: z.enum(["next", "undelivered", "returned"]),
  from: z.enum(shipmentStatuses),
});

export async function simulateShipmentAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("orders");
  const parsed = stepSchema.safeParse({
    orderId: formData.get("orderId"),
    step: formData.get("step"),
    from: formData.get("from"),
  });
  if (!parsed.success) return { status: "error", message: text.results.not_allowed };
  const { orderId, step, from } = parsed.data;
  const state = await guarded(() => simulateShipmentStep(user.id, orderId, step, from));
  refresh(orderId);
  return state;
}

const cancelSchema = z.object({
  orderId: orderIdSchema,
  note: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null),
});

export async function cancelOrderAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("orders");
  const parsed = cancelSchema.safeParse({
    orderId: formData.get("orderId"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { status: "error", message: text.cancelFailed };
  const result = await cancelOrder(user.id, parsed.data.orderId, parsed.data.note);
  refresh(parsed.data.orderId);
  if (!result.ok) return { status: "error", message: text.cancelFailed };
  return { status: "success", message: text.cancelled(result.restocked) };
}
