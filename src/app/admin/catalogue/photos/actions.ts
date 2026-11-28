"use server";

import { revalidatePath } from "next/cache";
import { labelPhotos as text } from "@/content/label-photos";
import { loadLabelPhotos } from "@/server/admin/label-photos";
import type { FormState } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";

/** "Load label photos": the client's label photos onto the catalogue (no input). */
export async function loadLabelPhotosAction(): Promise<FormState> {
  const { user } = await requireAdmin("catalogue", "/admin/catalogue/photos");
  const result = await loadLabelPhotos(user.id);
  if (!result.ok) return { status: "error", message: text.missing(result.file) };
  revalidatePath("/admin", "layout");
  revalidatePath("/products", "layout");
  revalidatePath("/launch", "layout");
  return { status: "success", message: text.loaded(result.products, result.photos) };
}
