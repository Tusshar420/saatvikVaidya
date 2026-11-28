"use server";

import { revalidatePath } from "next/cache";
import { labelPhotos as text } from "@/content/label-photos";
import { loadLabelPhotos, updateLabelPhotos } from "@/server/admin/label-photos";
import type { FormState } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";

/**
 * "Load label photos" (the client's label photos onto products without any)
 * or, with intent "update", "Update label photos" (older copies replaced).
 */
export async function loadLabelPhotosAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("catalogue", "/admin/catalogue/photos");
  const update = formData.get("intent") === "update";
  const result = update ? await updateLabelPhotos(user.id) : await loadLabelPhotos(user.id);
  if (!result.ok) return { status: "error", message: text.missing(result.file) };
  revalidatePath("/admin", "layout");
  revalidatePath("/products", "layout");
  revalidatePath("/launch", "layout");
  const done = update ? text.updated : text.loaded;
  return { status: "success", message: done(result.products, result.photos) };
}
