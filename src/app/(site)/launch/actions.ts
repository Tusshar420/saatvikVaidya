"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { brand as copy } from "@/content/brand";
import { formValues, type FormState } from "@/server/admin/form";
import { requireUser } from "@/server/auth/session";
import { MAX_BRAND_UNITS, packagingLimits } from "@/lib/brand";
import { brandThemeKeys } from "@/lib/brand-theme";
import { formatPaise } from "@/lib/format";
import { MAX_BRAND_PROFILES } from "@/lib/label";
import {
  addToBrandCart,
  brandCartCount,
  chooseBrandProduct,
  readBrandCart,
  removeFromBrandCart,
  setBrandCartQuantity,
  type BrandCartChange,
  type BrandCartError,
} from "@/server/brand/cart";
import { readDraft, savePackaging } from "@/server/brand/drafts";
import { profileFields } from "@/server/brand/packaging";
import {
  chooseProfile,
  chosenProfile,
  createProfile,
  listProfiles,
  type BrandProfileView,
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

/** The home page's "Add to Order": the minimum, or one more step of it. */
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

// ─── Saved brands (step 2) ──────────────────────────────────────────────────

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
  const { user } = await requireUser(fromAccount(values) ? "/account/brands" : "/launch?step=2");
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
  const { user } = await requireUser(fromAccount(values) ? "/account/brands" : "/launch?step=2");
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

// ─── Product page and brand details (steps 1 and 2) ─────────────────────────

const chooseProductSchema = z.object({
  productId: z.coerce.number().int().positive().max(2_147_483_647),
  theme: z.enum(brandThemeKeys),
});

/** "Continue — choose quantity" on a product's page: into the cart with the label theme, then step 2. */
export async function chooseBrandProductAction(formData: FormData): Promise<void> {
  const values = formValues(formData);
  const { user } = await requireUser(`/launch`);
  const parsed = chooseProductSchema.safeParse(values);
  // A page that was changed by hand: back to the catalogue.
  if (!parsed.success) redirect("/launch");
  const result = await chooseBrandProduct(user.id, parsed.data.productId, parsed.data.theme);
  // The product can't be added (not open for branding, a full cart, too large): back to the catalogue.
  if (!result.ok) redirect("/launch");
  revalidatePath("/launch");
  redirect("/launch?step=2");
}

const brandDetailsSchema = z.object({
  brandName: z
    .string()
    .trim()
    .min(1)
    .max(packagingLimits.brandName)
    .refine((text) => !/[\n\u0000-\u001f\u007f]/.test(text)),
  marketedByAddress: z.string().trim().min(1).max(packagingLimits.marketedByAddress),
});

export type BrandDetailsResult =
  | { ok: true; profileId: number; hasLogo: boolean }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/** The saved profile as the strings the profile form would send. */
function profileValues(profile: BrandProfileView): Record<string, string> {
  return Object.fromEntries(profileFields.map((field) => [field, String(profile[field] ?? "")]));
}

/**
 * Step 2, first half: the brand name and marketed-by address become this
 * order's brand (one profile: the one already used, or a new "My brand").
 * The logo is uploaded next (to /api/launch/logo, which needs the profile)
 * and `confirmBrandDetailsAction` finishes the step.
 */
export async function saveBrandDetailsAction(input: unknown): Promise<BrandDetailsResult> {
  const { user } = await requireUser("/launch?step=2");
  const errors = copy.brandStep.errors;
  const parsed = brandDetailsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "brandName") fieldErrors.brandName = errors.brandName;
      if (field === "marketedByAddress") fieldErrors.marketedByAddress = errors.address;
    }
    if (Object.keys(fieldErrors).length === 0) return { ok: false, message: errors.generic };
    return { ok: false, message: copy.packaging.errors.form, fieldErrors };
  }
  if ((await brandCartCount(user.id)) === 0) return { ok: false, message: errors.notReady };
  const [draft, profiles] = await Promise.all([readDraft(user.id), listProfiles(user.id)]);
  const profile = chosenProfile(profiles, draft);
  const details = { brandName: parsed.data.brandName, marketedByAddress: parsed.data.marketedByAddress };
  let profileId: number;
  if (profile) {
    const result = await updateProfile(user.id, profile.id, {
      ...profileValues(profile),
      ...details,
      marketedByName: profile.marketedByName || details.brandName,
    });
    if (!result.ok) return { ok: false, message: errors.generic };
    profileId = profile.id;
    await chooseProfile(user.id, profileId);
  } else {
    const result = await createProfile(user.id, {
      profileName: copy.brandStep.profileName,
      ...details,
      marketedByName: details.brandName,
    });
    if (!result.ok) {
      return { ok: false, message: result.error === "too_many" ? copy.profiles.errors.tooMany(MAX_BRAND_PROFILES) : errors.generic };
    }
    profileId = result.id;
    await chooseProfile(user.id, profileId);
  }
  revalidatePath("/launch");
  const saved = (await listProfiles(user.id)).find((row) => row.id === profileId);
  return { ok: true, profileId, hasLogo: Boolean(saved?.logo) };
}

const mrpsSchema = z.record(z.string().regex(/^\d{1,10}$/), z.string().max(12));

/**
 * Step 2, second half: the MRP of every product, then the step is done (the
 * brand has a logo, every label fits) and the order moves on to step 3.
 */
export async function confirmBrandDetailsAction(input: unknown): Promise<BrandDetailsResult> {
  const { user } = await requireUser("/launch?step=2");
  const errors = copy.brandStep.errors;
  const parsed = mrpsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: errors.generic };
  const mrps = new Map<number, number>();
  for (const [productId, text] of Object.entries(parsed.data)) {
    const rupees = /^\d{1,7}$/.test(text.trim()) ? Number(text.trim()) : 0;
    mrps.set(Number(productId), rupees);
  }
  const result = await savePackaging(user.id, { notes: "", mrps });
  revalidatePath("/launch");
  if (result.ok) return { ok: true, profileId: 0, hasLogo: true };
  if ("noProduct" in result) redirect("/launch");
  if ("noProfile" in result) return { ok: false, message: copy.packaging.errors.noProfile };
  if ("noLogo" in result) return { ok: false, message: errors.generic, fieldErrors: { logo: copy.brandStep.logoRequired } };
  if ("mrpProblems" in result) {
    const fieldErrors: Record<string, string> = {};
    const prices = new Map((await readBrandCart(user.id)).lines.map((line) => [line.productId, line.product?.terms.unitPricePaise ?? 0]));
    for (const [productId, problem] of result.mrpProblems) {
      fieldErrors[`mrp-${productId}`] =
        problem === "low"
          ? errors.mrp.low(formatPaise(prices.get(productId) ?? 0))
          : problem === "high"
            ? errors.mrp.high
            : errors.mrp.missing;
    }
    return { ok: false, message: copy.packaging.errors.form, fieldErrors };
  }
  return { ok: false, message: errors.generic };
}

export async function saveBrandAddressAction(
  _: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const { user } = await requireUser("/launch?step=3");
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

/** Step 3: "Place order and pay" opens the P1.4 payment screen. */
export async function placeBrandOrderAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser("/launch?step=3");
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
