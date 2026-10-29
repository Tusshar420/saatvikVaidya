import "server-only";
import { z } from "zod";
import { account as copy } from "@/content/account";
import { checkbox, fieldErrorsOf } from "@/server/admin/form";
import { db } from "@/server/db";

// The signed-in user's own settings on /account: name and notification
// preferences. Always scoped to the session's user id, never one from the
// request. Role, user type, phone and verification can't be changed here.

const nameField = z
  .string({ error: copy.errors.name })
  .trim()
  .min(2, copy.errors.name)
  .max(80, copy.errors.name);

export const nameFormSchema = z.object({ name: nameField });

export const notificationsFormSchema = z.object({
  notifyOrderSms: checkbox,
  notifyOrderEmail: checkbox,
  marketingOptIn: checkbox,
});

export type SettingsResult =
  | { ok: true }
  | { ok: false; fieldErrors: Record<string, string> };

export async function updateName(userId: string, values: unknown): Promise<SettingsResult> {
  const parsed = nameFormSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  await db.user.update({ where: { id: userId }, data: { name: parsed.data.name } });
  return { ok: true };
}

export async function updateNotifications(userId: string, values: unknown): Promise<SettingsResult> {
  const parsed = notificationsFormSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  await db.user.update({ where: { id: userId }, data: parsed.data });
  return { ok: true };
}
