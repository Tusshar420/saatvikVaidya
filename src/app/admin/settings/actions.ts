"use server";

import { revalidatePath } from "next/cache";
import { adminSettings as copy } from "@/content/admin-site";
import { formValues, type FormState } from "@/server/admin/form";
import {
  parseSettingsForm,
  saveSettings,
  type SettingsGroup,
} from "@/server/admin/settings";
import { requireAdmin } from "@/server/auth/session";
import { getSetting } from "@/server/content/settings";

// Server actions for /admin/settings, one per group of settings. Each checks
// the admin session itself and validates with Zod before anything is saved.

async function save(
  userId: string,
  group: SettingsGroup,
  formData: FormData,
): Promise<FormState> {
  const values = formValues(formData);
  const parsed = parseSettingsForm(group, values, {
    "coins.rules": await getSetting("coins.rules"),
  });
  if (!parsed.ok) {
    return {
      status: "error",
      message: copy.formError,
      fieldErrors: parsed.fieldErrors,
      values,
    };
  }
  const changed = await saveSettings(userId, parsed.changes);
  // The settings show in the site shell, so refresh every page.
  revalidatePath("/", "layout");
  return {
    status: "success",
    message: changed.length > 0 ? copy.saved : copy.unchanged,
  };
}

// Next needs each server action as its own exported async function, and each
// checks the admin session before anything else.

export async function saveContactAction(_: FormState, formData: FormData) {
  const { user } = await requireAdmin("settings", "/admin/settings");
  return save(user.id, "contact", formData);
}
export async function saveAnnouncementAction(_: FormState, formData: FormData) {
  const { user } = await requireAdmin("settings", "/admin/settings");
  return save(user.id, "announcement", formData);
}
export async function saveShippingAction(_: FormState, formData: FormData) {
  const { user } = await requireAdmin("settings", "/admin/settings");
  return save(user.id, "shipping", formData);
}
export async function saveSellerAction(_: FormState, formData: FormData) {
  const { user } = await requireAdmin("settings", "/admin/settings");
  return save(user.id, "seller", formData);
}
export async function saveSwitchesAction(_: FormState, formData: FormData) {
  const { user } = await requireAdmin("settings", "/admin/settings");
  return save(user.id, "switches", formData);
}
