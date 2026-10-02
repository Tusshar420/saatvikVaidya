"use server";

import { revalidatePath, updateTag } from "next/cache";
import { notFound, redirect } from "next/navigation";
import type { z } from "zod";
import { admin as copy } from "@/content/admin";
import {
  brandInputSchema,
  courseInputSchema,
  createContent,
  deleteContent,
  keySchema,
  reelInputSchema,
  updateContent,
  type ContentKind,
} from "@/server/admin/content";
import {
  fieldErrorsOf,
  formValues,
  intId,
  type FormState,
} from "@/server/admin/form";
import {
  createQuiz,
  deleteQuiz,
  quizInputSchema,
  updateQuiz,
} from "@/server/admin/quiz";
import { requireAdmin } from "@/server/auth/session";
import { contentTags } from "@/server/content/cache";

// Server actions for /admin/content/*. Each checks the admin session itself,
// validates with Zod and, for homepage content, expires the homepage cache
// so the change shows at once.

const listPath: Record<ContentKind | "quiz", string> = {
  reel: "/admin/content/reels",
  brand: "/admin/content/brands",
  course: "/admin/content/courses",
  quiz: "/admin/content/quiz",
};

const schemas: Record<ContentKind, z.ZodType> = {
  reel: reelInputSchema,
  brand: brandInputSchema,
  course: courseInputSchema,
};

function afterChange(kind: ContentKind | "quiz") {
  // The homepage reads the quiz schedule on every visit, so there is nothing to refresh.
  if (kind !== "quiz") updateTag(contentTags.home);
  revalidatePath("/admin", "layout");
}

async function create(
  kind: ContentKind,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin("content");
  const values = formValues(formData);
  const key = keySchema.safeParse(values.key);
  const parsed = schemas[kind].safeParse(values);
  if (!key.success || !parsed.success) {
    return {
      status: "error",
      fieldErrors: {
        ...(parsed.success ? {} : fieldErrorsOf(parsed.error)),
        ...(key.success ? {} : { key: copy.common.keyHelp }),
      },
      values,
    };
  }
  const result = await createContent(
    kind,
    key.data,
    // Safe: parsed by this kind's own schema just above.
    parsed.data as Parameters<typeof createContent>[2],
    user.id,
  );
  if (!result.ok) {
    return { status: "error", fieldErrors: result.fieldErrors, values };
  }
  afterChange(kind);
  redirect(`${listPath[kind]}?notice=created`);
}

async function update(
  kind: ContentKind,
  rawId: number,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin("content");
  const id = intId.safeParse(rawId);
  if (!id.success) notFound();
  const values = formValues(formData);
  const parsed = schemas[kind].safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    };
  }
  const result = await updateContent(
    kind,
    id.data,
    // Safe: parsed by this kind's own schema just above.
    parsed.data as Parameters<typeof updateContent>[2],
    user.id,
  );
  if (!result) return { status: "error", message: copy.common.notFound };
  if (!result.ok) {
    return { status: "error", fieldErrors: result.fieldErrors, values };
  }
  afterChange(kind);
  redirect(`${listPath[kind]}?notice=saved`);
}

async function remove(kind: ContentKind, formData: FormData): Promise<void> {
  const { user } = await requireAdmin("content");
  const id = intId.safeParse(formData.get("id"));
  if (!id.success) notFound();
  await deleteContent(kind, id.data, user.id);
  afterChange(kind);
  redirect(`${listPath[kind]}?notice=deleted`);
}

// Next needs each server action as its own exported async function.

export async function createReelAction(_: FormState, formData: FormData) {
  return create("reel", formData);
}
export async function updateReelAction(
  id: number,
  _: FormState,
  formData: FormData,
) {
  return update("reel", id, formData);
}
export async function deleteReelAction(formData: FormData) {
  return remove("reel", formData);
}

export async function createBrandAction(_: FormState, formData: FormData) {
  return create("brand", formData);
}
export async function updateBrandAction(
  id: number,
  _: FormState,
  formData: FormData,
) {
  return update("brand", id, formData);
}
export async function deleteBrandAction(formData: FormData) {
  return remove("brand", formData);
}

export async function createCourseAction(_: FormState, formData: FormData) {
  return create("course", formData);
}
export async function updateCourseAction(
  id: number,
  _: FormState,
  formData: FormData,
) {
  return update("course", id, formData);
}
export async function deleteCourseAction(formData: FormData) {
  return remove("course", formData);
}

// ─── Quiz ───────────────────────────────────────────────────────────────────

function parseQuiz(formData: FormData) {
  const values = formValues(formData);
  return { values, parsed: quizInputSchema.safeParse(values) };
}

export async function createQuizAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin("content");
  const { values, parsed } = parseQuiz(formData);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    };
  }
  await createQuiz(parsed.data, user.id);
  afterChange("quiz");
  redirect(`${listPath.quiz}?notice=created`);
}

export async function updateQuizAction(
  rawId: number,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin("content");
  const id = intId.safeParse(rawId);
  if (!id.success) notFound();
  const { values, parsed } = parseQuiz(formData);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    };
  }
  const saved = await updateQuiz(id.data, parsed.data, user.id);
  if (saved === "locked") {
    return { status: "error", fieldErrors: { questions: copy.quiz.errors.locked }, values };
  }
  if (!saved) return { status: "error", message: copy.common.notFound };
  afterChange("quiz");
  redirect(`${listPath.quiz}?notice=saved`);
}

export async function deleteQuizAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin("content");
  const id = intId.safeParse(formData.get("id"));
  if (!id.success) notFound();
  await deleteQuiz(id.data, user.id);
  afterChange("quiz");
  redirect(`${listPath.quiz}?notice=deleted`);
}
