"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { inventory as copy } from "@/content/inventory";
import {
  adjustStockAction,
  createComponent,
  receiveStockAction,
  saveRecipe,
  updateItemSettings,
  writeOffExpiredAction,
  type ActionResult,
} from "@/server/admin/inventory";
import { formValues, intId, type FormState } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";

// Server actions for /admin/inventory. Each checks the admin session itself
// (the "inventory" area) and validates with Zod in src/server/admin/inventory.ts.

function afterChange() {
  revalidatePath("/admin", "layout");
  revalidatePath("/products", "layout");
  revalidatePath("/launch");
}

function toState(result: ActionResult, values: Record<string, string>): FormState {
  if (result.ok) {
    afterChange();
    return { status: "success", message: result.message };
  }
  return {
    status: "error",
    message: result.message ?? copy.errors.form,
    fieldErrors: result.fieldErrors,
    values,
  };
}

export async function receiveAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("inventory");
  const values = formValues(formData);
  return toState(await receiveStockAction(values, user.id), values);
}

export async function adjustAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("inventory");
  const values = formValues(formData);
  return toState(await adjustStockAction(values, user.id), values);
}

export async function settingsAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("inventory");
  const values = formValues(formData);
  return toState(await updateItemSettings(values, user.id), values);
}

export async function writeOffAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("inventory");
  return toState(await writeOffExpiredAction(formData.get("batchId"), user.id), {});
}

export async function createComponentAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("inventory");
  const values = formValues(formData);
  const result = await createComponent(values, user.id);
  if (!result.ok) return { status: "error", message: copy.errors.form, fieldErrors: result.fieldErrors, values };
  afterChange();
  redirect(`/admin/inventory/b2b/${result.id}?notice=created`);
}

export async function saveRecipeAction(rawProductId: number, _: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("inventory");
  const productId = intId.safeParse(rawProductId);
  if (!productId.success) notFound();
  const values = formValues(formData);
  return toState(await saveRecipe(productId.data, values, user.id), values);
}
