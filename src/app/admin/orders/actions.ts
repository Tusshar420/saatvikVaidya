"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { admin as copy } from "@/content/admin";
import { orders as ordersCopy } from "@/content/orders";
import { orderIdPattern } from "@/lib/orders";
import { shipmentStatuses } from "@/lib/shipping";
import { formValues, type FormState } from "@/server/admin/form";
import { cancelOrder } from "@/server/admin/orders";
import { markOrderPaid } from "@/server/admin/order-payment";
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

const optionalText = (max: number, pattern?: RegExp) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !pattern || value === "" || pattern.test(value))
    .transform((value) => value || null);

// The courier and tracking number the admin types (manual shipping only;
// the test provider ignores them).
const createSchema = z.object({
  orderId: orderIdSchema,
  courierName: optionalText(80),
  trackingNumber: optionalText(40, /^[A-Za-z0-9][A-Za-z0-9/-]*$/),
});

export async function createShipmentAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("orders");
  const parsed = createSchema.safeParse({
    orderId: formData.get("orderId"),
    courierName: formData.get("courierName") ?? "",
    trackingNumber: formData.get("trackingNumber") ?? "",
  });
  if (!parsed.success) {
    if (!orderIdSchema.safeParse(formData.get("orderId")).success) {
      return { status: "error", message: text.results.not_found };
    }
    return { status: "error", message: text.results.invalid_details, values: formValues(formData) };
  }
  const { orderId, courierName, trackingNumber } = parsed.data;
  const state = await guarded(() => createShipment(user.id, orderId, { courierName, trackingNumber }));
  refresh(orderId);
  return state.status === "error" ? { ...state, values: formValues(formData) } : state;
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

export async function markPaidAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("orders");
  const orderId = orderIdSchema.safeParse(formData.get("orderId"));
  if (!orderId.success) return { status: "error", message: text.markPaid.errors.not_found };
  const result = await markOrderPaid(user.id, orderId.data);
  refresh(orderId.data);
  if (!result.ok) return { status: "error", message: text.markPaid.errors[result.error] };
  return { status: "success", message: result.changed ? text.markPaid.done : text.markPaid.unchanged };
}
