"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  linkReportToError,
  reportLinkSchema,
  reportUpdateSchema,
  unlinkReportFromError,
  updateReport,
} from "@/server/admin/bug-reports";
import { requireAdmin } from "@/server/auth/session";

// Problem reports in the error log (Phase 4): status and note, and links to
// errors. Each action checks the admin session first and validates its input
// with Zod; the outcome comes back to the report page as ?done=.

const list = "/admin/errors/reports";
const page = (id: number, done: string) => `${list}/${id}?done=${done}`;

function reportId(formData: FormData): number | null {
  const parsed = z.coerce.number().int().positive().safeParse(formData.get("id"));
  return parsed.success ? parsed.data : null;
}

export async function updateReportAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin("errors", list);
  const parsed = reportUpdateSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    adminNote: formData.get("adminNote") ?? "",
  });
  if (!parsed.success) redirect(list);
  const { id, ...values } = parsed.data;
  const found = await updateReport(user.id, id, values);
  revalidatePath(list);
  redirect(found ? page(id, "saved") : list);
}

export async function linkErrorAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin("errors", list);
  const id = reportId(formData);
  if (!id) redirect(list);
  const parsed = reportLinkSchema.safeParse({ id, error: formData.get("error") });
  if (!parsed.success) redirect(page(id, "bad-reference"));
  const result = await linkReportToError(user.id, id, parsed.data.error);
  if (result === "noReport") redirect(list);
  revalidatePath(list);
  redirect(page(id, result === "noError" ? "no-error" : result));
}

export async function unlinkErrorAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin("errors", list);
  const parsed = z
    .object({ id: z.coerce.number().int().positive(), groupId: z.coerce.number().int().positive() })
    .safeParse({ id: formData.get("id"), groupId: formData.get("groupId") });
  if (!parsed.success) redirect(list);
  await unlinkReportFromError(user.id, parsed.data.id, parsed.data.groupId);
  revalidatePath(list);
  redirect(page(parsed.data.id, "unlinked"));
}
