"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assistedOrders as copy } from "@/content/assisted-orders";
import { assistedCodePattern, assistedOrderIdPattern } from "@/lib/assisted-orders";
import { formValues, type FormState } from "@/server/admin/form";
import {
  cancelAssistedOrder,
  createAssistedOrder,
  placeAssistedOrderByStaff,
  resendAssistedOrderLink,
  sendAssistedOrderCode,
} from "@/server/assisted-orders/assisted-orders";
import { requireAdmin } from "@/server/auth/session";
import { saveAddressFromForm, type AddressFormState } from "@/server/checkout/addresses";
import { getSetting } from "@/server/content/settings";
import { db } from "@/server/db";
import type { Sent } from "@/server/notify/assisted-orders";

// Server actions for /admin/assisted-orders: prepare an order for a
// customer, send its link again, send the customer a code, place it for
// them with that code, add an address for them, and cancel it. Each checks
// the admin session itself (orders area) and validates its input with Zod.

const createText = copy.admin.create;
const text = copy.admin.detail;
const idSchema = z.string().regex(assistedOrderIdPattern);

/** "sms", "email", "both" or "none": shown on the page after a send. */
function sentKey(sent: Sent): string {
  return sent.sms && sent.email ? "both" : sent.sms ? "sms" : sent.email ? "email" : "none";
}

function channelsText(sent: Sent): string {
  return sent.sms && sent.email ? text.channels.both : sent.sms ? text.channels.sms : text.channels.email;
}

function refresh(id: string) {
  revalidatePath("/admin/assisted-orders");
  revalidatePath(`/admin/assisted-orders/${id}`);
}

const itemsJson = z
  .string()
  .max(20_000)
  .transform((value, context) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({ code: "custom", message: "items" });
      return z.NEVER;
    }
  });

export async function createAssistedOrderAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("orders");
  const values = formValues(formData);
  const items = itemsJson.safeParse(values.items ?? "[]");
  if (!items.success || !Array.isArray(items.data)) {
    return { status: "error", message: createText.errors.items, values };
  }
  const result = await createAssistedOrder(user.id, {
    userId: values.userId ?? "",
    note: values.note ?? "",
    items: items.data as { productId: number; quantity: number }[],
  });
  if (!result.ok) {
    const errors = createText.errors;
    const message =
      result.error === "quantity"
        ? errors.quantity(result.name, result.min)
        : result.error === "customer"
          ? errors.customer
          : result.error === "admin"
            ? errors.admin
            : result.error === "items"
              ? errors.items
              : result.error === "too_many"
                ? errors.tooMany
                : result.error === "product"
                  ? errors.product
                  : errors.generic;
    return { status: "error", message, values };
  }
  revalidatePath("/admin/assisted-orders");
  redirect(`/admin/assisted-orders/${result.id}?sent=${sentKey(result.sent)}`);
}

export async function resendLinkAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin("orders");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: text.errors.not_found };
  const result = await resendAssistedOrderLink(id.data);
  refresh(id.data);
  if (!result.ok) return { status: "error", message: text.errors[result.error] };
  if (!result.sent.sms && !result.sent.email) return { status: "error", message: text.sentNowhere };
  return { status: "success", message: text.resent(channelsText(result.sent)) };
}

export async function cancelAssistedAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("orders");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: text.errors.not_found };
  const done = await cancelAssistedOrder(user.id, id.data);
  refresh(id.data);
  return done ? { status: "success", message: text.cancelled } : { status: "error", message: text.errors.closed };
}

export async function sendCodeAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("orders");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: text.errors.not_found };
  const result = await sendAssistedOrderCode(user.id, id.data);
  refresh(id.data);
  if (!result.ok) return { status: "error", message: text.errors[result.error] };
  return { status: "success", message: text.codeSent(channelsText(result.sent), result.minutes) };
}

const placeSchema = z.object({
  id: idSchema,
  code: z.string().trim().regex(assistedCodePattern),
  addressId: z.coerce.number().int().positive().max(2_147_483_647),
  expectedTotalPaise: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});

export async function placeByStaffAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("orders");
  const values = formValues(formData);
  const parsed = placeSchema.safeParse(values);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const message =
      field === "addressId"
        ? text.errors.address
        : field === "code"
          ? text.errors.code_format
          : text.errors.generic;
    return { status: "error", message, values, fieldErrors: field === "code" ? { code: message } : undefined };
  }
  if (!(await getSetting("checkout.enabled")).enabled) {
    return { status: "error", message: text.errors.checkout_off, values };
  }
  const result = await placeAssistedOrderByStaff(user.id, parsed.data);
  refresh(parsed.data.id);
  if (!result.ok) {
    const message =
      result.error === "wrong_code" ? text.errors.wrong_code(result.triesLeft) : text.errors[result.error];
    return {
      status: "error",
      message,
      values: { ...values, code: "" },
      fieldErrors: result.error === "wrong_code" ? { code: message } : undefined,
    };
  }
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${result.orderId}`);
}

/** Adds (or edits) a delivery address on the customer's account, for a call. */
export async function saveCustomerAddressAction(
  id: string,
  _: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  await requireAdmin("orders");
  const parsedId = idSchema.safeParse(id);
  const order = parsedId.success
    ? await db.assistedOrder.findUnique({ where: { id: parsedId.data }, select: { userId: true, status: true } })
    : null;
  if (!order || order.status !== "open") return { status: "error", message: text.errors.closed };
  const result = await saveAddressFromForm(order.userId, formValues(formData));
  if (result.status === "success") refresh(id);
  return result;
}
