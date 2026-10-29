"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { admin as copy } from "@/content/admin";
import {
  fieldErrorsOf,
  formValues,
  type FormState,
} from "@/server/admin/form";
import {
  createUser,
  decideVerification,
  deleteUsers,
  noteSchema,
  updateUser,
  userIdsSchema,
  userInputSchema,
} from "@/server/admin/users";
import { requireAdmin } from "@/server/auth/session";

// Server actions for /admin/users and /admin/approvals. Each one checks the
// admin session itself (actions are public endpoints), validates its input
// with Zod, and never returns more than a message.

/** Refreshes every admin page (counts in the nav and dashboard change). */
function refreshAdmin() {
  revalidatePath("/admin", "layout");
}

export async function createUserAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin("users");
  const values = formValues(formData);
  const parsed = userInputSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrorsOf(parsed.error),
      values: { ...values, password: "" },
    };
  }
  const result = await createUser(parsed.data, user.id);
  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: result.fieldErrors,
      values: { ...values, password: "" },
    };
  }
  refreshAdmin();
  redirect(`/admin/users/${result.id}?notice=created`);
}

const userIdSchema = z.string().trim().min(1).max(64);

export async function updateUserAction(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin("users");
  const userId = userIdSchema.safeParse(id);
  if (!userId.success) notFound();
  const values = formValues(formData);
  const parsed = userInputSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    };
  }
  const result = await updateUser(userId.data, parsed.data, user.id);
  if (!result) return { status: "error", message: copy.common.notFound };
  if (!result.ok) {
    return { status: "error", fieldErrors: result.fieldErrors, values };
  }
  refreshAdmin();
  redirect(`/admin/users/${userId.data}?notice=saved`);
}

const bulkSchema = z.object({
  operation: z.enum(["approve", "reject", "delete"]),
  ids: userIdsSchema,
  note: noteSchema,
});

/** Approve, reject or delete the users ticked on the users page. */
export async function bulkUsersAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // Deleting accounts is for the users area; approving or rejecting is the
  // approvals area's job, so an approvals admin can use bulk decisions too.
  const { user } = await requireAdmin(
    formData.get("operation") === "delete" ? "users" : "approvals",
  );
  const parsed = bulkSchema.safeParse({
    operation: formData.get("operation"),
    ids: formData.getAll("ids"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: copy.users.bulk.noneSelected };
  }
  const { operation, ids, note } = parsed.data;
  const result =
    operation === "delete"
      ? await deleteUsers(ids, user.id)
      : await decideVerification(
          ids,
          operation === "approve" ? "approved" : "rejected",
          note,
          user.id,
        );
  refreshAdmin();
  return {
    status: "success",
    message: copy.users.bulk.done[operation](result.changed, result.skipped),
  };
}

const decisionSchema = z.object({
  id: userIdSchema,
  decision: z.enum(["approved", "rejected"]),
  note: noteSchema,
});

/** Approve or reject one account, with an optional note. */
export async function decideUserAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin("approvals");
  const parsed = decisionSchema.safeParse({
    id: formData.get("id"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: copy.common.saveFailed };
  }
  const { id, decision, note } = parsed.data;
  const result = await decideVerification([id], decision, note, user.id);
  if (result.changed === 0) {
    return { status: "error", message: copy.userDetail.notProfessional };
  }
  refreshAdmin();
  return {
    status: "success",
    message:
      decision === "approved"
        ? copy.userDetail.decide.approved
        : copy.userDetail.decide.rejected,
  };
}

/** Delete one user from their detail page. */
export async function deleteUserAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin("users");
  const id = userIdSchema.safeParse(formData.get("id"));
  if (!id.success) notFound();
  const result = await deleteUsers([id.data], user.id);
  refreshAdmin();
  // Nothing deleted: it was the admin's own account, or already gone.
  if (result.changed === 0) redirect("/admin/users");
  redirect("/admin/users?notice=deleted");
}
