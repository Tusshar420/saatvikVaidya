"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assistedOrders as assistedCopy } from "@/content/assisted-orders";
import { checkout as copy } from "@/content/checkout";
import { assistedOrderIdPattern, preparedOrderPath } from "@/lib/assisted-orders";
import { formValues, type FormState } from "@/server/admin/form";
import { requireUser } from "@/server/auth/session";
import { saveAddressFromForm, type AddressFormState } from "@/server/checkout/addresses";
import { placeOrder, type PlaceOrderError } from "@/server/checkout/orders";
import { getSetting } from "@/server/content/settings";
import { getPricingViewer } from "@/server/pricing";

// Server actions for /orders/prepared/[id], the customer's page for an order
// our staff prepared. Both are bound to the prepared order's id on the page;
// placeOrder() checks it belongs to the signed-in customer and is still open.

const idSchema = z.string().regex(assistedOrderIdPattern);

const placeSchema = z.object({
  addressId: z.coerce.number().int().positive().max(2_147_483_647),
  checkoutKey: z.uuid(),
  expectedTotalPaise: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
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
  closed: assistedCopy.customer.errors.closed,
};

export async function placePreparedOrderAction(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { status: "error", message: placeErrors.closed };
  const path = preparedOrderPath(parsedId.data);
  const { user } = await requireUser(path);
  const parsed = placeSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    const missingAddress = parsed.error.issues.some((issue) => issue.path[0] === "addressId");
    return { status: "error", message: missingAddress ? copy.place.errors.address : copy.place.errors.generic };
  }
  const [viewer, shipping, discount, coinRules, checkoutSwitch, maintenance] = await Promise.all([
    getPricingViewer(),
    getSetting("checkout.shipping"),
    getSetting("pricing.discount"),
    getSetting("coins.rules"),
    getSetting("checkout.enabled"),
    getSetting("site.maintenance"),
  ]);
  // The checkout switch, and maintenance mode, as at the normal checkout.
  if (!checkoutSwitch.enabled || (maintenance.enabled && (user.role !== "admin" || !user.twoFactorEnabled))) {
    return { status: "error", message: placeErrors.checkout_off };
  }
  const result = await placeOrder({
    userId: user.id,
    viewer,
    shipping,
    discountPercent: discount.percent,
    coinRules,
    ...parsed.data,
    assisted: { id: parsedId.data, placedBy: "customer" },
  });
  if (!result.ok) {
    if (["cart_changed", "empty", "coins", "closed"].includes(result.error)) revalidatePath(path);
    return { status: "error", message: placeErrors[result.error] };
  }
  revalidatePath("/orders");
  redirect(`/checkout/pay/${result.orderId}`);
}

export async function savePreparedAddressAction(
  id: string,
  _: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const parsedId = idSchema.safeParse(id);
  const path = parsedId.success ? preparedOrderPath(parsedId.data) : "/orders";
  const { user } = await requireUser(path);
  const result = await saveAddressFromForm(user.id, formValues(formData));
  if (result.status === "success") revalidatePath(path);
  return result;
}
