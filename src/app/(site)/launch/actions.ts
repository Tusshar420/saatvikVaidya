"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { brand as copy } from "@/content/brand";
import { formValues, type FormState } from "@/server/admin/form";
import { requireUser } from "@/server/auth/session";
import {
  chooseBrandProduct,
  saveBrandQuantity,
  savePackaging,
} from "@/server/brand/drafts";
import { placeBrandOrder, type PlaceBrandOrderError } from "@/server/brand/orders";
import { saveAddressFromForm, type AddressFormState } from "@/server/checkout/addresses";
import { getSetting } from "@/server/content/settings";

// Server actions for /launch (Launch Your Brand, P2.1). Each checks the
// session itself (requireUser) and validates its input with Zod. The
// browser sends ids, text and a quantity; the server checks the product,
// the quantity step and the price, and never takes a price from the browser.

const productIdSchema = z.coerce.number().int().positive().max(2_147_483_647);
const quantitySchema = z.coerce.number().int().positive().max(1_000_000);

/** Step 1: "Choose" on a product. */
export async function chooseProductAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser("/launch");
  const productId = productIdSchema.safeParse(formData.get("productId"));
  if (!productId.success || !(await chooseBrandProduct(user.id, productId.data))) {
    revalidatePath("/launch");
    return { status: "error", message: copy.product.errors.product };
  }
  redirect("/launch?step=2");
}

/** Step 2: the packaging text (the logo is uploaded on its own first). */
export async function savePackagingAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser("/launch?step=2");
  const values = formValues(formData);
  const result = await savePackaging(user.id, values);
  if (!result.ok) {
    if ("noProduct" in result) redirect("/launch?step=1");
    return {
      status: "error",
      message: copy.packaging.errors.form,
      fieldErrors: result.fieldErrors,
      values,
    };
  }
  redirect("/launch?step=3");
}

/** Step 3: the quantity, which must be a multiple of the product's minimum. */
export async function saveQuantityAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser("/launch?step=3");
  const quantity = quantitySchema.safeParse(formData.get("quantity"));
  const result = await saveBrandQuantity(user.id, quantity.success ? quantity.data : null);
  if (!result.ok) {
    if (result.error === "quantity") {
      return { status: "error", message: copy.quantity.errors.quantity(result.minQty) };
    }
    redirect(result.error === "product" ? "/launch?step=1" : "/launch?step=2");
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
