"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { brand as copy } from "@/content/brand";
import { formValues, type FormState } from "@/server/admin/form";
import { requireUser } from "@/server/auth/session";
import { MAX_BRAND_UNITS } from "@/lib/brand";
import { labelFields, MAX_BRAND_PROFILES, type LabelField, type LabelValues } from "@/lib/label";
import {
  addToBrandCart,
  brandCartCount,
  removeFromBrandCart,
  setBrandCartQuantity,
  type BrandCartChange,
  type BrandCartError,
} from "@/server/brand/cart";
import { savePackaging } from "@/server/brand/drafts";
import {
  chooseProfile,
  createProfile,
  deleteProfile,
  setDefaultProfile,
  updateProfile,
  type ProfileResult,
} from "@/server/brand/profiles";
import { placeBrandOrder, type PlaceBrandOrderError } from "@/server/brand/orders";
import { saveAddressFromForm, type AddressFormState } from "@/server/checkout/addresses";
import { getSetting } from "@/server/content/settings";

// Server actions for /launch (Build Your Brand, P2.1, and the Launch
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
    case "above_stock":
      return errors.aboveStock(error.available);
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

// ─── Saved brands (step 3) ──────────────────────────────────────────────────

/** Both places that list the saved brands. */
function revalidateBrands() {
  revalidatePath("/launch");
  revalidatePath("/account/brands");
}

/** Brands are also managed on the account page, which has no order to use them in. */
function fromAccount(values: Record<string, string>): boolean {
  return values.context === "account";
}

const profileIdSchema = z.coerce.number().int().positive().max(2_147_483_647);

/** Success carries the brand's id in `values.id`, so the form can go on to its logo. */
function savedProfile(id: number): FormState {
  revalidateBrands();
  return { status: "success", message: copy.profiles.messages.saved, values: { id: String(id) } };
}

function profileFailure(result: Extract<ProfileResult, { ok: false }>, values: Record<string, string>): FormState {
  if (result.error === "invalid") {
    return {
      status: "error",
      message: copy.profiles.errors.form,
      fieldErrors: result.fieldErrors,
      values,
    };
  }
  const message =
    result.error === "too_many"
      ? copy.profiles.errors.tooMany(MAX_BRAND_PROFILES)
      : copy.profiles.errors.notFound;
  return { status: "error", message, values };
}

/**
 * Saves a brand: a new one (it is also picked for this order) or, with an
 * `id`, changes of a saved one. `makeDefault` ("on") makes it the default.
 */
export async function saveBrandProfileAction(_: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const { user } = await requireUser(fromAccount(values) ? "/account/brands" : "/launch?step=3");
  const id = values.id ? profileIdSchema.safeParse(values.id) : null;
  if (id && !id.success) return { status: "error", message: copy.profiles.errors.notFound, values };
  if (id?.success) {
    const result = await updateProfile(user.id, id.data, values);
    if (!result.ok) return profileFailure(result, values);
    if (values.makeDefault === "on") await setDefaultProfile(user.id, id.data);
    return savedProfile(id.data);
  }
  const result = await createProfile(user.id, values, { makeDefault: values.makeDefault === "on" });
  if (!result.ok) return profileFailure(result, values);
  // A new brand is the one this order uses (when there's a cart to order).
  if (!fromAccount(values) && (await brandCartCount(user.id)) > 0) await chooseProfile(user.id, result.id);
  return savedProfile(result.id);
}

const profileActionSchema = z.object({ id: profileIdSchema });

/** The result of a quick change to a saved brand (use, default, delete). */
export type ProfileChangeResult = { ok: true; message: string } | { ok: false; message: string };

async function changeProfile(
  formData: FormData,
  change: (userId: string, profileId: number) => Promise<boolean>,
  message: string,
): Promise<ProfileChangeResult> {
  const values = formValues(formData);
  const { user } = await requireUser(fromAccount(values) ? "/account/brands" : "/launch?step=3");
  const parsed = profileActionSchema.safeParse(values);
  if (!parsed.success) return { ok: false, message: copy.profiles.errors.notFound };
  if (!(await change(user.id, parsed.data.id))) return { ok: false, message: copy.profiles.errors.notFound };
  revalidateBrands();
  return { ok: true, message };
}

/** "Use this brand": this order's labels start from it. */
export async function chooseBrandProfileAction(
  _: ProfileChangeResult | null,
  formData: FormData,
): Promise<ProfileChangeResult> {
  return changeProfile(formData, chooseProfile, copy.profiles.messages.chosen);
}

export async function setDefaultBrandProfileAction(
  _: ProfileChangeResult | null,
  formData: FormData,
): Promise<ProfileChangeResult> {
  return changeProfile(formData, setDefaultProfile, copy.profiles.messages.defaultSet);
}

export async function deleteBrandProfileAction(
  _: ProfileChangeResult | null,
  formData: FormData,
): Promise<ProfileChangeResult> {
  return changeProfile(formData, deleteProfile, copy.profiles.messages.deleted);
}

// ─── Packaging (step 3) ─────────────────────────────────────────────────────

/** The label fields typed for each product: form fields named `label-<productId>-<field>`. */
function typedLabels(values: Record<string, string>): Map<number, LabelValues> {
  const labels = new Map<number, LabelValues>();
  const fields = new Set<string>(labelFields);
  for (const [name, value] of Object.entries(values)) {
    const match = /^label-(\d{1,10})-([a-zA-Z]+)$/.exec(name);
    if (!match || !fields.has(match[2]!)) continue;
    const productId = Number(match[1]);
    labels.set(productId, { ...labels.get(productId), [match[2] as LabelField]: value });
  }
  return labels;
}

/** Step 3: the notes and each product's label details, then on to review. */
export async function savePackagingAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser("/launch?step=3");
  const values = formValues(formData);
  const result = await savePackaging(user.id, { notes: values.notes, labels: typedLabels(values) });
  if (!result.ok) {
    if ("noProduct" in result) redirect("/launch");
    const errors = copy.packaging.errors;
    revalidatePath("/launch");
    if ("noProfile" in result) return { status: "error", message: errors.noProfile, values };
    if ("noLogo" in result) return { status: "error", message: errors.logo, values };
    if ("notesError" in result) {
      return { status: "error", message: errors.form, fieldErrors: { notes: result.notesError }, values };
    }
    const fieldErrors: Record<string, string> = {};
    for (const [productId, problems] of result.labelProblems) {
      for (const problem of problems) {
        fieldErrors[`label-${productId}-${problem.field}`] =
          problem.length === 0
            ? copy.labels.blankBrand
            : copy.labels.over(problem.length - problem.limit, problem.limit);
      }
    }
    return { status: "error", message: errors.labels, fieldErrors, values };
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
