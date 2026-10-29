import "server-only";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { admin as copy } from "@/content/admin";
import type { Prisma } from "@/generated/prisma/client";
import { gstRates, productSlugPattern, slugify } from "@/lib/catalogue";
import { ebookCoverUpload, ebookFileUpload } from "@/lib/ebooks";
import { paiseToRupeeInput, rupeesToPaise } from "@/lib/format";
import { contentTags } from "@/server/content/cache";
import { db } from "@/server/db";
import { deleteFilesQuietly, getStorage, newFileKey } from "@/server/storage";
import { checkUpload, cleanFileName } from "@/server/storage/files";
import { createdFields, diffFields, logAdminAction } from "./audit";
import { blankToNull, checkbox, fieldErrorsOf, optionalText, requiredText, sortOrder } from "./form";

// Ebooks in the admin panel (/admin/ebooks, P1.8): create, edit, hide, upload
// the cover and the PDF, and the site-wide download switch. Callers (server
// actions and the upload route) check the admin session first and pass the
// admin's id as `actorId`. Ebooks are hidden rather than deleted, so buyers
// keep their downloads and orders keep their link.

const errors = copy.ebooks.errors;

/** ₹1,00,000: far above any ebook. */
const MAX_PAISE = 10_000_000;

const ebookFormSchema = z
  .object({
    title: requiredText(160, errors.title),
    slug: z.preprocess(
      blankToNull,
      z
        .string({ error: errors.slug })
        .trim()
        .toLowerCase()
        .max(120, errors.slug)
        .regex(productSlugPattern, errors.slug)
        .nullable(),
    ),
    author: optionalText(120, errors.author),
    description: requiredText(5000, errors.description),
    isFree: checkbox,
    price: z.preprocess(blankToNull, z.string().nullable()),
    gstRate: z.coerce
      .number({ error: errors.gstRate })
      .refine((rate) => (gstRates as readonly number[]).includes(rate), errors.gstRate),
    downloadsEnabled: checkbox,
    active: checkbox,
    sortOrder: sortOrder(errors.sortOrder),
  })
  .transform((data, ctx) => {
    const slug = data.slug ?? slugify(data.title);
    if (!slug) ctx.addIssue({ code: "custom", path: ["slug"], message: errors.slug });
    let pricePaise = 0;
    if (!data.isFree) {
      const paise = data.price === null ? null : rupeesToPaise(data.price);
      if (paise === null || paise <= 0 || paise > MAX_PAISE) {
        ctx.addIssue({ code: "custom", path: ["price"], message: errors.price });
      } else {
        pricePaise = paise;
      }
    }
    return {
      title: data.title,
      slug,
      author: data.author,
      description: data.description,
      isFree: data.isFree,
      pricePaise,
      gstRate: data.gstRate,
      downloadsEnabled: data.downloadsEnabled,
      active: data.active,
      sortOrder: data.sortOrder,
    };
  });

export type EbookInput = z.output<typeof ebookFormSchema>;

export function parseEbookForm(
  values: Record<string, string>,
): { success: true; data: EbookInput } | { success: false; fieldErrors: Record<string, string> } {
  const parsed = ebookFormSchema.safeParse(values);
  if (parsed.success) return { success: true, data: parsed.data };
  return { success: false, fieldErrors: fieldErrorsOf(parsed.error) };
}

export const newEbookValues = {
  title: "",
  slug: "",
  author: "",
  description: "",
  isFree: false,
  price: "",
  gstRate: "18",
  downloadsEnabled: true,
  active: true,
  sortOrder: "0",
};

export function ebookFormValues(ebook: {
  title: string;
  slug: string;
  author: string | null;
  description: string;
  isFree: boolean;
  pricePaise: number;
  gstRate: number;
  downloadsEnabled: boolean;
  active: boolean;
  sortOrder: number;
}) {
  return {
    title: ebook.title,
    slug: ebook.slug,
    author: ebook.author ?? "",
    description: ebook.description,
    isFree: ebook.isFree,
    price: ebook.isFree ? "" : paiseToRupeeInput(ebook.pricePaise),
    gstRate: String(ebook.gstRate),
    downloadsEnabled: ebook.downloadsEnabled,
    active: ebook.active,
    sortOrder: String(ebook.sortOrder),
  };
}

// ─── Reading ────────────────────────────────────────────────────────────────

export async function listAdminEbooks() {
  return db.ebook.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      author: true,
      isFree: true,
      pricePaise: true,
      coverKey: true,
      fileKey: true,
      fileName: true,
      fileSizeBytes: true,
      downloadsEnabled: true,
      active: true,
    },
  });
}

export async function getAdminEbook(id: number) {
  return db.ebook.findUnique({ where: { id } });
}

// ─── Changes ────────────────────────────────────────────────────────────────

export type EbookResult =
  | { ok: true; id: number }
  | { ok: false; fieldErrors: Record<string, string> };

const slugTaken = { ok: false as const, fieldErrors: { slug: errors.slugTaken } };

function isUniqueClash(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

export async function createEbook(input: EbookInput, actorId: string): Promise<EbookResult> {
  try {
    return await db.$transaction(async (tx) => {
      const ebook = await tx.ebook.create({ data: input, select: { id: true } });
      await logAdminAction(tx, {
        actorId,
        action: "ebook.create",
        resource: "Ebook",
        resourceId: ebook.id,
        changes: createdFields(input),
      });
      return { ok: true as const, id: ebook.id };
    });
  } catch (error) {
    if (isUniqueClash(error)) return slugTaken;
    throw error;
  }
}

/** Null when the ebook no longer exists. */
export async function updateEbook(
  id: number,
  input: EbookInput,
  actorId: string,
): Promise<EbookResult | null> {
  try {
    return await db.$transaction(async (tx) => {
      const before = await tx.ebook.findUnique({ where: { id } });
      if (!before) return null;
      const changes = diffFields(before, input);
      if (Object.keys(changes).length === 0) return { ok: true as const, id };
      await tx.ebook.update({ where: { id }, data: input });
      await logAdminAction(tx, {
        actorId,
        action: "ebook.update",
        resource: "Ebook",
        resourceId: id,
        changes,
      });
      return { ok: true as const, id };
    });
  } catch (error) {
    if (isUniqueClash(error)) return slugTaken;
    throw error;
  }
}

export type EbookUploadKind = "cover" | "file";

export type EbookUploadError = "notFound" | "empty" | "tooLarge" | "fileType";

export const ebookUploadRules = { cover: ebookCoverUpload, file: ebookFileUpload } as const;

/**
 * Checks and stores a cover or the book's PDF, replacing the old one (which
 * is deleted after the database points at the new file). `fileName` is the
 * uploaded name, kept (cleaned) as the download name for the PDF.
 */
export async function uploadEbookFile(options: {
  ebookId: number;
  kind: EbookUploadKind;
  bytes: Uint8Array;
  fileName: string;
  actorId: string;
}): Promise<{ ok: true } | { ok: false; error: EbookUploadError }> {
  const rules = ebookUploadRules[options.kind];
  const checked = checkUpload<string>(options.bytes, rules);
  if (!checked.ok) return checked;
  const exists = await db.ebook.count({ where: { id: options.ebookId } });
  if (!exists) return { ok: false, error: "notFound" };

  const folder = options.kind === "cover" ? "ebook-covers" : "ebooks";
  const key = newFileKey(folder, String(options.ebookId), checked.extension);
  await getStorage().put(key, options.bytes);

  let previous: string | null = null;
  try {
    const found = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ coverKey: string | null; fileKey: string | null }[]>`
        SELECT coverKey, fileKey FROM Ebook WHERE id = ${options.ebookId} FOR UPDATE`;
      const row = rows[0];
      if (!row) return false;
      const data: Prisma.EbookUpdateInput =
        options.kind === "cover"
          ? { coverKey: key, coverContentType: checked.contentType }
          : {
              fileKey: key,
              fileName: cleanFileName(options.fileName, checked.extension),
              fileSizeBytes: options.bytes.byteLength,
            };
      previous = options.kind === "cover" ? row.coverKey : row.fileKey;
      await tx.ebook.update({ where: { id: options.ebookId }, data });
      await logAdminAction(tx, {
        actorId: options.actorId,
        action: "ebook.file.upload",
        resource: "Ebook",
        resourceId: options.ebookId,
        changes: createdFields({ [options.kind]: options.fileName.slice(0, 120) }),
      });
      return true;
    });
    if (!found) {
      await deleteFilesQuietly([key]);
      return { ok: false, error: "notFound" };
    }
  } catch (error) {
    await deleteFilesQuietly([key]);
    throw error;
  }
  if (previous) await deleteFilesQuietly([previous]);
  return { ok: true };
}

/** Turns ebook downloads on or off across the site ("ebooks.downloads"). */
export async function setSiteDownloads(actorId: string, enabled: boolean): Promise<void> {
  const value = { enabled };
  await db.$transaction(async (tx) => {
    const before = await tx.setting.findUnique({ where: { key: "ebooks.downloads" } });
    await tx.setting.upsert({
      where: { key: "ebooks.downloads" },
      create: { key: "ebooks.downloads", value, updatedBy: actorId },
      update: { value, updatedBy: actorId },
    });
    await tx.settingHistory.create({
      data: { settingKey: "ebooks.downloads", value, changedBy: actorId },
    });
    await logAdminAction(tx, {
      actorId,
      action: "ebooks.downloads.update",
      resource: "Setting",
      resourceId: "ebooks.downloads",
      changes: {
        enabled: {
          from: (before?.value as { enabled?: unknown } | null)?.enabled ?? null,
          to: enabled,
        },
      },
    });
  });
  revalidateTag(contentTags.settings, "max");
}
