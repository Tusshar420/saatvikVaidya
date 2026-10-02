"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { checkout as copy } from "@/content/checkout";
import { checkoutPathFor, orderIdPattern } from "@/lib/orders";
import { formValues, type FormState } from "@/server/admin/form";
import { requireUser } from "@/server/auth/session";
import { saveAddressFromForm, type AddressFormState } from "@/server/checkout/addresses";
import { placeOrder, retryPayment, type PlaceOrderError } from "@/server/checkout/orders";
import { completePayment } from "@/server/checkout/payments";
import { getSetting } from "@/server/content/settings";
import { getPaymentProvider, PaymentProviderUnavailableError } from "@/server/payments";
import { getPricingViewer } from "@/server/pricing";

// Server actions for /checkout and the payment screens. Each checks the
// session itself (requireUser) and validates its input with Zod. The browser
// sends ids, a checkout key and the simulated outcome, never a price.

export type { AddressFormState };

const idSchema = z.coerce.number().int().positive().max(2_147_483_647);
const orderIdSchema = z.string().regex(orderIdPattern);

export async function saveAddressAction(
  _: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const { user } = await requireUser("/checkout");
  const result = await saveAddressFromForm(user.id, formValues(formData));
  if (result.status === "success") revalidatePath("/checkout");
  return result;
}

const placeSchema = z.object({
  addressId: idSchema,
  checkoutKey: z.uuid(),
  expectedTotalPaise: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  /** The "Use my coins" checkbox: "on" when ticked, missing otherwise. */
  redeemCoins: z
    .literal("on")
    .optional()
    .transform((value) => value === "on"),
});

const placeErrors: Record<PlaceOrderError, string> = {
  address: copy.place.errors.address,
  empty: copy.place.errors.empty,
  cart_changed: copy.place.errors.cartChanged,
  payments_off: copy.place.errors.paymentsOff,
  checkout_off: copy.place.errors.checkoutOff,
  coins: copy.place.errors.coins,
  rate_limited: copy.place.errors.generic,
};

export async function placeOrderAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser("/checkout");
  const parsed = placeSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    const missingAddress = parsed.error.issues.some((issue) => issue.path[0] === "addressId");
    return {
      status: "error",
      message: missingAddress ? copy.place.errors.address : copy.place.errors.generic,
    };
  }
  const [viewer, shipping, coinRules, checkoutSwitch, maintenance] = await Promise.all([
    getPricingViewer(),
    getSetting("checkout.shipping"),
    getSetting("coins.rules"),
    getSetting("checkout.enabled"),
    getSetting("site.maintenance"),
  ]);
  // The checkout switch, and maintenance mode (admins can still order).
  if (!checkoutSwitch.enabled || (maintenance.enabled && (user.role !== "admin" || !user.twoFactorEnabled))) {
    return { status: "error", message: placeErrors.checkout_off };
  }
  const result = await placeOrder({ userId: user.id, viewer, shipping, coinRules, ...parsed.data });
  if (!result.ok) {
    // Show the cart as it is now, so the summary matches what changed.
    if (["cart_changed", "empty", "coins"].includes(result.error)) revalidatePath("/checkout");
    return { status: "error", message: placeErrors[result.error] };
  }
  redirect(`/checkout/pay/${result.orderId}`);
}

const simulateSchema = z.object({
  orderId: orderIdSchema,
  reference: z.string().min(1).max(64),
  outcome: z.enum(["success", "failure"]),
});

/** "Simulate success" / "Simulate failure" on the test payment screen. */
export async function simulatePaymentAction(formData: FormData): Promise<void> {
  const parsed = simulateSchema.safeParse(formValues(formData));
  if (!parsed.success) notFound();
  const { orderId, reference, outcome } = parsed.data;
  const { user } = await requireUser(`/checkout/pay/${orderId}`);

  const provider = getPaymentProvider();
  if (provider.name !== "test") notFound();
  let result;
  try {
    const verified = await provider.verifyPayment(reference, { outcome });
    result = await completePayment(verified, user.id);
  } catch (error) {
    if (error instanceof PaymentProviderUnavailableError) redirect(`/checkout/pay/${orderId}`);
    throw error;
  }
  if (!result || result.orderId !== orderId) notFound();
  // The bag count changes after a successful payment.
  revalidatePath("/", "layout");
  redirect(checkoutPathFor(result.orderId, result.status));
}

/** "Try again" (or "Continue to payment"): a new attempt on the same order. */
export async function retryPaymentAction(formData: FormData): Promise<void> {
  const orderId = orderIdSchema.safeParse(formData.get("orderId"));
  if (!orderId.success) notFound();
  const { user } = await requireUser(`/checkout/pay/${orderId.data}`);
  await retryPayment(user.id, orderId.data);
  redirect(`/checkout/pay/${orderId.data}`);
}
