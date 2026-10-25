"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { adminSecurity as copy } from "@/content/admin-security";
import {
  changeAdminRole,
  inviteAdmin,
  removeAdmin,
  resetAdminTwoFactor,
  revokeInvite,
  type Done,
  type Failure,
} from "@/server/admin/admins";
import { formValues, type FormState } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";

// Server actions for /admin/admins. Super admins only: each one checks the
// "admins" area itself (actions are public endpoints). Ids come from hidden
// fields and are checked with Zod before use.

const idSchema = z.string().trim().min(1).max(64);
const numberIdSchema = z.coerce.number().int().positive();

function refresh() {
  revalidatePath("/admin/admins");
}

/** Back to the list with a notice, or with the reason it didn't work. */
function finish(result: Done | Failure, notice: string): never {
  refresh();
  if (!result.ok) redirect(`/admin/admins?error=${encodeURIComponent(result.error)}`);
  redirect(`/admin/admins?notice=${notice}`);
}

/** The form's state, plus the invitation link to pass on by hand. */
export type InviteFormState = FormState & { inviteUrl?: string };

export async function inviteAdminAction(
  _previous: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const { user } = await requireAdmin("admins");
  const values = formValues(formData);
  const result = await inviteAdmin(
    { email: values.email ?? "", role: values.role ?? "" },
    { id: user.id, name: user.name },
  );
  if (!result.ok) {
    return {
      status: "error",
      message: result.error,
      fieldErrors: result.field ? { [result.field]: result.error } : undefined,
      values,
    };
  }
  refresh();
  return { status: "success", message: copy.admins.notices.invited, inviteUrl: result.url };
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin("admins");
  const id = numberIdSchema.safeParse(formData.get("id"));
  if (!id.success) notFound();
  finish(await revokeInvite(id.data, user.id), "revoked");
}

export async function changeAdminRoleAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin("admins");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) notFound();
  finish(
    await changeAdminRole(id.data, String(formData.get("role") ?? ""), user.id),
    "role",
  );
}

export async function resetTwoFactorAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin("admins");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) notFound();
  finish(await resetAdminTwoFactor(id.data, user.id), "reset");
}

export async function removeAdminAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin("admins");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) notFound();
  finish(await removeAdmin(id.data, user.id), "removed");
}
