"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { threads as copy } from "@/content/threads";
import { pollLimits } from "@/lib/threads";
import { formValues, type FormState } from "@/server/admin/form";
import { rateLimitRules } from "@/server/auth/policy";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { requireUser } from "@/server/auth/session";
import { addReply, createThread, toggleLike, votePoll, type ThreadResult } from "@/server/threads/threads";

// Server actions for Dr. Talk. Each checks the session itself; the server
// module checks that posts and replies come from a verified doctor (likes and
// poll votes are open to every member). The author id always comes from the session.

const idSchema = z.coerce.number().int().positive();

async function allowed(userId: string): Promise<boolean> {
  return (await hitRateLimit(rateLimitRules.threadWritePerUser, userId)).allowed;
}

function failure(result: Extract<ThreadResult, { ok: false }>): FormState {
  if (result.error === "forbidden") return { status: "error", message: copy.errors.forbidden };
  if (result.error === "invalid") {
    return { status: "error", message: copy.errors.generic, fieldErrors: result.fieldErrors };
  }
  return { status: "error", message: copy.errors.generic };
}

export async function createThreadAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser("/doctor-talk");
  const values = formValues(formData);
  if (!(await allowed(user.id))) return { status: "error", message: copy.errors.rateLimited, values };
  // The form names its poll boxes pollOption1…pollOption6; "poll" is on while the poll part is open.
  const pollOptions =
    values.poll === "on"
      ? Array.from({ length: pollLimits.max }, (_, i) => values[`pollOption${i + 1}`] ?? "")
      : undefined;
  const result = await createThread(user.id, { ...values, pollOptions });
  if (!result.ok) return { ...failure(result), values };
  revalidatePath("/doctor-talk");
  redirect(`/doctor-talk/${result.id}`);
}

export async function replyAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser("/doctor-talk");
  const values = formValues(formData);
  const id = idSchema.safeParse(values.threadId);
  if (!id.success) return { status: "error", message: copy.errors.generic };
  if (!(await allowed(user.id))) return { status: "error", message: copy.errors.rateLimited, values };
  const result = await addReply(user.id, id.data, { body: values.body });
  if (!result.ok) return { ...failure(result), values };
  revalidatePath(`/doctor-talk/${id.data}`);
  revalidatePath("/doctor-talk");
  return { status: "success" };
}

export async function likeAction(formData: FormData): Promise<void> {
  const { user } = await requireUser("/doctor-talk");
  const id = idSchema.safeParse(formData.get("threadId"));
  if (!id.success || !(await allowed(user.id))) return;
  await toggleLike(user.id, id.data);
  revalidatePath("/doctor-talk");
  revalidatePath(`/doctor-talk/${id.data}`);
}

export async function voteAction(formData: FormData): Promise<void> {
  const { user } = await requireUser("/doctor-talk");
  const threadId = idSchema.safeParse(formData.get("threadId"));
  const optionId = idSchema.safeParse(formData.get("optionId"));
  if (!threadId.success || !optionId.success || !(await allowed(user.id))) return;
  await votePoll(user.id, threadId.data, optionId.data);
  revalidatePath("/doctor-talk");
  revalidatePath(`/doctor-talk/${threadId.data}`);
}
