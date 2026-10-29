"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signInPath } from "@/lib/auth-routes";
import { getSession } from "@/server/auth/session";
import { saveAnswer, startAttempt, submitAttempt } from "@/server/quiz/attempts";

// Quiz & Win actions. Each one checks the session itself and reads the user's
// own attempt only; ids from the client are validated and never trusted for
// whose attempt it is.

const id = z.coerce.number().int().positive().max(2_147_483_647);

export async function startQuizAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect(signInPath("/quiz"));
  const quizId = id.safeParse(formData.get("quizId"));
  if (quizId.success) await startAttempt(session.user.id, quizId.data);
  revalidatePath("/quiz");
  redirect("/quiz");
}

export type SaveAnswerResponse = { status: "saved" | "expired" | "finished" | "invalid" | "signed_out" };

export async function saveAnswerAction(rawQuizId: number, rawQuestionId: number, rawOptionId: number): Promise<SaveAnswerResponse> {
  const session = await getSession();
  if (!session) return { status: "signed_out" };
  const parsed = z.tuple([id, id, id]).safeParse([rawQuizId, rawQuestionId, rawOptionId]);
  if (!parsed.success) return { status: "invalid" };
  const result = await saveAnswer(session.user.id, parsed.data[0], parsed.data[1], parsed.data[2]);
  if (result.status === "no_attempt") return { status: "invalid" };
  return { status: result.status };
}

export async function submitQuizAction(rawQuizId: number): Promise<{ ok: boolean }> {
  const session = await getSession();
  const quizId = id.safeParse(rawQuizId);
  if (!session || !quizId.success) return { ok: false };
  const result = await submitAttempt(session.user.id, quizId.data);
  revalidatePath("/quiz");
  return { ok: result !== null };
}
