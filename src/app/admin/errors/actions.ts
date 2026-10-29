"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/auth/session";
import { setErrorStatus, statusChangeSchema } from "@/server/admin/errors";

// Change an error's status. Checks the admin session first and validates its
// input with Zod; a bad value just goes back to the page.
export async function setErrorStatusAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin("errors", "/admin/errors");
  const parsed = statusChangeSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) redirect("/admin/errors");
  const found = await setErrorStatus(user.id, parsed.data.id, parsed.data.status);
  revalidatePath("/admin/errors");
  redirect(found ? `/admin/errors/${parsed.data.id}?saved=1` : "/admin/errors");
}
