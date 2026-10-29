"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { brand as copy } from "@/content/brand";
import { requireAdmin } from "@/server/auth/session";
import {
  BRAND_IMPORT_MAX_BYTES,
  applyBrandImport,
  previewBrandImport,
  type ImportPreview,
} from "@/server/brand/import";

// Server actions for /admin/catalogue/brand-import (P2.1). Both check the
// admin session (catalogue area). Preview reads the uploaded file; apply
// gets the same text back and checks it again from the start.

export type ImportState = {
  status: "idle" | "preview" | "error" | "applied";
  message?: string;
  /** The CSV text, sent back with "Apply import". */
  csv?: string;
  preview?: Extract<ImportPreview, { ok: true }>;
};

const text = copy.import;

const fileSchema = z.instanceof(File).refine((file) => file.size > 0);

/** One action for the page: "Apply import" sends the previewed text back, "Preview" a file. */
export async function brandImportAction(_: ImportState, formData: FormData): Promise<ImportState> {
  const { user } = await requireAdmin("catalogue", "/admin/catalogue/brand-import");
  return formData.get("intent") === "apply" ? applyImport(formData, user.id) : previewImport(formData);
}

async function previewImport(formData: FormData): Promise<ImportState> {
  const file = fileSchema.safeParse(formData.get("file"));
  if (!file.success) return { status: "error", message: text.errors.file };
  if (file.data.size > BRAND_IMPORT_MAX_BYTES) return { status: "error", message: text.errors.tooLarge };
  let csv: string;
  try {
    csv = new TextDecoder("utf-8", { fatal: true }).decode(await file.data.arrayBuffer());
  } catch {
    return { status: "error", message: text.errors.encoding };
  }
  const preview = await previewBrandImport(csv);
  if (!preview.ok) return { status: "error", message: preview.error };
  return { status: "preview", csv, preview };
}

const csvSchema = z.string().min(1).max(BRAND_IMPORT_MAX_BYTES);

async function applyImport(formData: FormData, actorId: string): Promise<ImportState> {
  const csv = csvSchema.safeParse(formData.get("csv"));
  if (!csv.success) return { status: "error", message: text.errors.file };
  const result = await applyBrandImport(csv.data, actorId);
  if (!result.ok) {
    return {
      status: result.preview?.ok ? "preview" : "error",
      message: result.error,
      csv: csv.data,
      preview: result.preview?.ok ? result.preview : undefined,
    };
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/launch");
  return { status: "applied", message: text.applied(result.updated) };
}
