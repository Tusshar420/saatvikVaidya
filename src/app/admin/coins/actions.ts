"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { admin as copy } from "@/content/admin";
import { fieldErrorsOf, formValues, type FormState } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";
import { adjustCoins } from "@/server/coins/ledger";
import { coinRulesForm, updateCoinRules } from "@/server/coins/rules";
import { formatNumber } from "@/lib/format";

// Server actions for /admin/coins and the coin panel on a user's page. Each
// checks the admin session itself and validates its input with Zod.

export async function updateCoinRulesAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const values = formValues(formData);
  const parsed = coinRulesForm.safeParse(values);
  if (!parsed.success) {
    const errors = fieldErrorsOf(parsed.error);
    for (const key of Object.keys(errors)) errors[key] = copy.coins.errors.number;
    return { status: "error", message: copy.coins.errors.form, fieldErrors: errors, values };
  }
  await updateCoinRules(user.id, parsed.data);
  revalidatePath("/", "layout");
  return { status: "success", message: copy.coins.saved };
}

const text = copy.userDetail.coins;

const adjustSchema = z.object({
  userId: z.string().min(1).max(64),
  amount: z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? Number(value.trim()) : Number.NaN),
    z
      .number({ error: text.errors.amount })
      .int(text.errors.amount)
      .min(-1_000_000, text.errors.amount)
      .max(1_000_000, text.errors.amount)
      .refine((value) => value !== 0, text.errors.amount),
  ),
  note: z.string({ error: text.errors.note }).trim().min(1, text.errors.note).max(300, text.errors.note),
});

export async function adjustCoinsAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const values = formValues(formData);
  const parsed = adjustSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: copy.common.formError,
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    };
  }
  const result = await adjustCoins(user.id, parsed.data.userId, parsed.data.amount, parsed.data.note);
  if (!result.ok) {
    return {
      status: "error",
      message: result.error === "insufficient" ? text.errors.insufficient : text.errors.notFound,
      values,
    };
  }
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/", "layout");
  return { status: "success", message: text.saved(formatNumber(result.balance)) };
}
