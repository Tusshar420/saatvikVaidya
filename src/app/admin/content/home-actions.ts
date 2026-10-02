"use server";

import { revalidatePath, updateTag } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { adminHome as copy, homeKinds, type HomeKindKey } from "@/content/admin-site";
import { fieldErrorsOf, formValues, intId, keyOf, type FormState } from "@/server/admin/form";
import {
  createHomeRow,
  deleteHomeRow,
  homeInputSchemas,
  parseSectionsForm,
  sectionHeadingSchema,
  updateHomeRow,
  updateSectionHeading,
  updateSections,
} from "@/server/admin/home-content";
import { requireAdmin } from "@/server/auth/session";
import { contentTags } from "@/server/content/cache";

// Server actions for the homepage content under /admin/content (hero slides,
// offers, stats, quick actions, categories, feedback, why-steps, sections).
// Each checks the admin session itself, validates with Zod and expires the
// homepage cache so the change shows at once.

const isKind = (value: string): value is HomeKindKey => value in homeKinds;

function listPath(kind: HomeKindKey): string {
  return `/admin/content/${homeKinds[kind].path}`;
}

function afterChange() {
  updateTag(contentTags.home);
  revalidatePath("/", "layout");
}

export async function createHomeAction(kind: string, _: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  if (!isKind(kind)) notFound();
  const values = formValues(formData);
  const key = keyOf(values.key);
  const parsed = homeInputSchemas[kind].safeParse(values);
  if (!key.success || !parsed.success) {
    return {
      status: "error",
      message: copy.formError,
      fieldErrors: {
        ...(parsed.success ? {} : fieldErrorsOf(parsed.error)),
        ...(key.success ? {} : { key: copy.keyInvalid }),
      },
      values,
    };
  }
  const result = await createHomeRow(kind, key.data, parsed.data, user.id);
  if (!result.ok) return { status: "error", message: copy.formError, fieldErrors: result.fieldErrors, values };
  afterChange();
  redirect(`${listPath(kind)}?notice=created`);
}

export async function updateHomeAction(
  kind: string,
  rawId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin();
  if (!isKind(kind)) notFound();
  const id = intId.safeParse(rawId);
  if (!id.success) notFound();
  const values = formValues(formData);
  const parsed = homeInputSchemas[kind].safeParse(values);
  if (!parsed.success) {
    return { status: "error", message: copy.formError, fieldErrors: fieldErrorsOf(parsed.error), values };
  }
  const result = await updateHomeRow(kind, id.data, parsed.data, user.id);
  if (!result) return { status: "error", message: copy.notFound };
  afterChange();
  redirect(`${listPath(kind)}?notice=saved`);
}

export async function deleteHomeAction(kind: string, formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  if (!isKind(kind)) notFound();
  const id = intId.safeParse(formData.get("id"));
  if (!id.success) notFound();
  await deleteHomeRow(kind, id.data, user.id);
  afterChange();
  redirect(`${listPath(kind)}?notice=deleted`);
}

export async function saveSectionsAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const values = formValues(formData);
  const parsed = parseSectionsForm(values);
  if (!parsed.ok) {
    return { status: "error", message: copy.formError, fieldErrors: parsed.fieldErrors, values };
  }
  await updateSections(user.id, parsed.rows);
  afterChange();
  return { status: "success", message: copy.sections.saved };
}

export async function updateSectionHeadingAction(
  key: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin();
  const values = formValues(formData);
  const parsed = sectionHeadingSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", message: copy.formError, fieldErrors: fieldErrorsOf(parsed.error), values };
  }
  if (!(await updateSectionHeading(user.id, key, parsed.data))) notFound();
  afterChange();
  redirect("/admin/content/sections?notice=saved");
}
