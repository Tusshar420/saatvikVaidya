"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { brand as copy } from "@/content/brand";
import { formValues, type FormState } from "@/server/admin/form";
import { requireUser } from "@/server/auth/session";
import { MAX_BRAND_UNITS } from "@/lib/brand";
import {
  addToBrandCart,
  removeFromBrandCart,
  setBrandCartQuantity,
  type BrandCartChange,
  type BrandCartError,
} from "@/server/brand/cart";
import { savePackaging } from "@/server/brand/drafts";
import { placeBrandOrder, type PlaceBrandOrderError } from "@/server/brand/orders";
import { saveAddressFromForm, type AddressFormState } from "@/server/checkout/addresses";
import { getSetting } from "@/server/content/settings";

// Server actions for /launch (Launch Your Brand, P2.1, and the Launch
// cart). Each checks the session itself (requireUser) and validates its
// input with Zod. The browser sends ids, text and quantities; the server
// checks the products, the quantity steps and the prices, and never takes a
// price from the browser.

const productIdSchema = z.number().int().positive().max(2_147_483_647);
const cartLineSchema = z.object({
  productId: productIdSchema,
  quantity: z.number().int().positive().max(MAX_BRAND_UNITS),
});
const cartProductSchema = cartLineSchema.pick({ productId: true });

export type BrandCartActionResult =
  | { ok: true; quantity: number; count: number }
  | { ok: false; message: string };

function cartMessage(error: BrandCartError): string {
  const errors = copy.cart.errors;
  switch (error.kind) {
    case "unavailable":
      return errors.unavailable;
    case "not_in_cart":
      return errors.notInCart;
    case "quantity":
      return errors.quantity(error.minQty);
    case "too_many_lines":
      return errors.tooManyLines(error.max);
    case "too_large":
      return errors.tooLarge;
  }
}

function cartResult(result: BrandCartChange): BrandCartActionResult {
  // The catalogue, the cart and later steps all show the cart.
  revalidatePath("/launch");
  if (!result.ok) return { ok: false, message: cartMessage(result.error) };
  return { ok: true, quantity: result.quantity, count: result.count };
}

/** Step 1: "Add to launch cart" (the minimum), or one more step of it. */
export async function addToBrandCartAction(input: unknown): Promise<BrandCartActionResult> {
  const { user } = await requireUser("/launch");
  const parsed = cartProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: copy.cart.errors.generic };
  return cartResult(await addToBrandCart(user.id, parsed.data.productId));
}

/** Step 2: a new quantity for one product (a multiple of its minimum). */
export async function setBrandCartQuantityAction(input: unknown): Promise<BrandCartActionResult> {
  const { user } = await requireUser("/launch?step=2");
  const parsed = cartLineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: copy.cart.errors.generic };
  return cartResult(await setBrandCartQuantity(user.id, parsed.data.productId, parsed.data.quantity));
}

/** Step 2: takes a product out of the cart. */
export async function removeFromBrandCartAction(input: unknown): Promise<BrandCartActionResult> {
  const { user } = await requireUser("/launch?step=2");
  const parsed = cartProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: copy.cart.errors.generic };
  const { count } = await removeFromBrandCart(user.id, parsed.data.productId);
  revalidatePath("/launch");
  return { ok: true, quantity: 0, count };
}

/** Step 3: the packaging text (the logo is uploaded on its own first). */
export async function savePackagingAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser("/launch?step=3");
  const values = formValues(formData);
  const result = await savePackaging(user.id, values);
  if (!result.ok) {
    if ("noProduct" in result) redirect("/launch");
    return {
      status: "error",
      message: copy.packaging.errors.form,
      fieldErrors: result.fieldErrors,
      values,
    };
  }
  redirect("/launch?step=4");
}

export async function saveBrandAddressAction(
  _: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const { user } = await requireUser("/launch?step=4");
  const result = await saveAddressFromForm(user.id, formValues(formData));
  if (result.status === "success") revalidatePath("/launch");
  return result;
}

const placeSchema = z.object({
  addressId: z.coerce.number().int().positive().max(2_147_483_647),
  checkoutKey: z.uuid(),
  expectedTotalPaise: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});

const placeErrors: Record<PlaceBrandOrderError, string> = {
  address: copy.review.errors.address,
  draft: copy.review.errors.draft,
  changed: copy.review.errors.changed,
  payments_off: copy.review.errors.paymentsOff,
  rate_limited: copy.review.errors.generic,
};

/** Step 4: "Place order and pay" opens the P1.4 payment screen. */
export async function placeBrandOrderAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser("/launch?step=4");
  const parsed = placeSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    const missingAddress = parsed.error.issues.some((issue) => issue.path[0] === "addressId");
    return {
      status: "error",
      message: missingAddress ? copy.review.errors.address : copy.review.errors.generic,
    };
  }
  const [shipping, checkoutSwitch, maintenance] = await Promise.all([
    getSetting("checkout.shipping"),
    getSetting("checkout.enabled"),
    getSetting("site.maintenance"),
  ]);
  // The checkout switch and maintenance mode stop brand orders too (admins
  // with two-factor can still order, as at the store checkout).
  if (!checkoutSwitch.enabled || (maintenance.enabled && (user.role !== "admin" || !user.twoFactorEnabled))) {
    return { status: "error", message: copy.review.errors.checkoutOff };
  }
  const result = await placeBrandOrder({ userId: user.id, shipping, ...parsed.data });
  if (!result.ok) {
    if (result.error === "changed" || result.error === "draft") revalidatePath("/launch");
    return { status: "error", message: placeErrors[result.error] };
  }
  revalidatePath("/my-brand");
  redirect(`/checkout/pay/${result.orderId}`);
}
