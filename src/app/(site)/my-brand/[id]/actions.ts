"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { brand as copy } from "@/content/brand";
import { proofCommentMax } from "@/lib/brand-stage";
import { orderIdPattern } from "@/lib/orders";
import { formValues, type FormState } from "@/server/admin/form";
import { requireUser } from "@/server/auth/session";
import { decideProof } from "@/server/brand/stages";

// Server action for /my-brand/[id]: the customer approves the latest proof
// or asks for changes with a comment. The session decides whose order it is;
// the server checks the order is theirs and the proof is the one waiting.

const text = copy.proof;

const schema = z.object({
  orderId: z.string().regex(orderIdPattern),
  proofId: z.coerce.number().int().min(1).max(2_000_000_000),
  decision: z.enum(["approve", "changes"]),
  comment: z.string().trim().max(proofCommentMax).optional(),
});

export async function decideProofAction(_: FormState, formData: FormData): Promise<FormState> {
  const orderId = formData.get("orderId");
  const { user } = await requireUser(typeof orderId === "string" ? `/my-brand/${orderId}` : "/my-brand");
  const parsed = schema.safeParse({
    orderId,
    proofId: formData.get("proofId"),
    decision: formData.get("decision"),
    comment: formData.get("comment") ?? undefined,
  });
  if (!parsed.success) {
    return formData.get("decision") === "changes"
      ? { status: "error", fieldErrors: { comment: text.errors.comment }, message: text.errors.comment, values: formValues(formData) }
      : { status: "error", message: text.errors.invalid };
  }
  const { decision, comment } = parsed.data;
  if (decision === "changes" && !comment) {
    return { status: "error", fieldErrors: { comment: text.errors.comment }, message: text.errors.comment, values: formValues(formData) };
  }
  const result = await decideProof({
    userId: user.id,
    orderId: parsed.data.orderId,
    proofId: parsed.data.proofId,
    decision,
    comment: comment ?? null,
  });
  revalidatePath(`/my-brand/${parsed.data.orderId}`);
  if (!result.ok) {
    const message =
      result.error === "not_allowed" || result.error === "not_found"
        ? text.errors[result.error]
        : result.error === "invalid"
          ? text.errors.comment
          : text.errors.generic;
    return { status: "error", message };
  }
  return { status: "success", message: decision === "approve" ? text.approved : text.changesSent };
}
