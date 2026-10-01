"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { admin as copy } from "@/content/admin";
import {
  createEbook,
  parseEbookForm,
  setSiteDownloads,
  updateEbook,
} from "@/server/admin/ebooks";
import { checkbox, formValues, intId, type FormState } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";

// Server actions for /admin/ebooks (P1.8). Each checks the admin session
// itself and validates with Zod. Covers and PDFs are uploaded through
// /api/admin/ebooks/[id]/files instead (server actions cap bodies at 1 MB).

function afterChange() {
  revalidatePath("/admin", "layout");
  revalidatePath("/ebooks", "layout");
  revalidatePath("/account");
}

export async function createEbookAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const values = formValues(formData);
  const parsed = parseEbookForm(values);
  if (!parsed.success) return { status: "error", fieldErrors: parsed.fieldErrors, values };
  const result = await createEbook(parsed.data, user.id);
  if (!result.ok) return { status: "error", fieldErrors: result.fieldErrors, values };
  afterChange();
  // Straight to the edit page, where the cover and PDF can be uploaded.
  redirect(`/admin/ebooks/${result.id}/edit?notice=created`);
}

export async function updateEbookAction(
  rawId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = intId.safeParse(rawId);
  if (!id.success) notFound();
  const values = formValues(formData);
  const parsed = parseEbookForm(values);
  if (!parsed.success) return { status: "error", fieldErrors: parsed.fieldErrors, values };
  const result = await updateEbook(id.data, parsed.data, user.id);
  if (!result) return { status: "error", message: copy.common.notFound };
  if (!result.ok) return { status: "error", fieldErrors: result.fieldErrors, values };
  afterChange();
  redirect("/admin/ebooks?notice=saved");
}

/** The site-wide switch: the form sends enabled=on to turn downloads on. */
export async function setSiteDownloadsAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const enabled = checkbox.parse(formData.get("enabled"));
  await setSiteDownloads(user.id, enabled);
  afterChange();
  redirect(`/admin/ebooks?notice=${enabled ? "downloadsOn" : "downloadsOff"}`);
}
