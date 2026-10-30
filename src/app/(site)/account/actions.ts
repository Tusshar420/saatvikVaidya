"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { isAPIError } from "better-auth/api";
import { z } from "zod";
import { account as copy } from "@/content/account";
import { authErrors } from "@/content/auth";
import { formValues, type FormState } from "@/server/admin/form";
import { updateName, updateNotifications } from "@/server/account/settings";
import { auth } from "@/server/auth";
import { rateLimitRules } from "@/server/auth/policy";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { readAccount } from "@/server/auth/account";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { requireUser } from "@/server/auth/session";
import { sendTestEmail } from "@/server/notify";
import {
  deleteAddress,
  saveAddressFromForm,
  type AddressFormState,
} from "@/server/checkout/addresses";

// Server actions for /account. Each checks the session itself (requireUser)
// and validates its input with Zod; the user id always comes from the
// session, never from the form.

export async function updateNameAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser("/account");
  const values = formValues(formData);
  const result = await updateName(user.id, values);
  if (!result.ok) {
    return { status: "error", message: copy.errors.form, fieldErrors: result.fieldErrors, values };
  }
  revalidatePath("/account");
  revalidatePath("/", "layout");
  return { status: "success", message: copy.nameForm.saved };
}

export async function saveNotificationsAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser("/account");
  const result = await updateNotifications(user.id, formValues(formData));
  if (!result.ok) return { status: "error", message: copy.errors.generic };
  revalidatePath("/account");
  return { status: "success", message: copy.notifications.saved };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, copy.errors.currentRequired).max(1024, copy.errors.generic),
  newPassword: z.string().min(1, authErrors.PASSWORD_TOO_SHORT).max(1024, authErrors.PASSWORD_TOO_LONG),
});

/** Changes the password through Better Auth, so our password rules apply. */
export async function changePasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser("/account");
  const parsed = passwordSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { status: "error", message: copy.errors.form, fieldErrors };
  }
  const limit = await hitRateLimit(rateLimitRules.passwordChangePerUser, user.id);
  if (!limit.allowed) return { status: "error", message: authErrors.RATE_LIMITED };
  try {
    const requestHeaders = await headers();
    await auth.api.changePassword({ body: parsed.data, headers: requestHeaders });
    // Sign out the other devices, keeping this one. (changePassword's own
    // revokeOtherSessions swaps this session for a new one, and the page
    // that re-renders after this action would still use the old cookie and
    // send the user to sign-in.)
    await auth.api.revokeOtherSessions({ headers: requestHeaders });
  } catch (error) {
    if (!isAPIError(error)) throw error;
    const code = error.body?.code;
    if (code === "INVALID_PASSWORD") {
      return {
        status: "error",
        message: copy.errors.form,
        fieldErrors: { currentPassword: copy.password.wrongCurrent },
      };
    }
    if (typeof code === "string" && Object.hasOwn(authErrors, code)) {
      const message = authErrors[code as keyof typeof authErrors];
      const field = code.startsWith("PASSWORD_") ? "newPassword" : undefined;
      return field
        ? { status: "error", message: copy.errors.form, fieldErrors: { [field]: message } }
        : { status: "error", message };
    }
    return { status: "error", message: copy.errors.generic };
  }
  return { status: "success", message: copy.password.saved };
}

/** Emails a verification link to the signed-in user's own address. */
export async function sendVerificationEmailAction(): Promise<FormState> {
  const { user } = await requireUser("/account");
  const profile = await readAccount(user.id);
  if (!profile?.email || profile.emailVerified) {
    return { status: "error", message: copy.emailVerify.failed };
  }
  try {
    await auth.api.sendVerificationEmail({
      body: { email: profile.email, callbackURL: "/account?emailVerified=1" },
      headers: await headers(),
    });
  } catch (error) {
    if (!isAPIError(error)) throw error;
    return {
      status: "error",
      message: error.status === "TOO_MANY_REQUESTS" ? copy.emailVerify.tooMany : copy.emailVerify.failed,
    };
  }
  return { status: "success", message: copy.emailVerify.sent(profile.email) };
}

/** Sends a test email to the signed-in user's own address and says what happened. */
export async function sendTestEmailAction(): Promise<FormState> {
  const { user } = await requireUser("/account");
  const profile = await readAccount(user.id);
  if (!profile?.email || isPlaceholderEmail(profile.email)) {
    return { status: "error", message: copy.testEmail.noEmail };
  }
  const limit = await hitRateLimit(rateLimitRules.testEmailPerUser, user.id);
  if (!limit.allowed) return { status: "error", message: copy.testEmail.tooMany };
  const result = await sendTestEmail(profile.email, copy.testEmail.subject, copy.testEmail.body(profile.name));
  if (result.ok) return { status: "success", message: copy.testEmail.sent(profile.email) };
  return {
    status: "error",
    message: result.reason === "not-configured" ? copy.testEmail.notConfigured : copy.testEmail.failed(result.detail),
  };
}

export async function saveAccountAddressAction(
  _: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const { user } = await requireUser("/account/addresses");
  const result = await saveAddressFromForm(user.id, formValues(formData));
  if (result.status === "success") revalidatePath("/account/addresses");
  return result;
}

const addressIdSchema = z.coerce.number().int().positive().max(2_147_483_647);

export async function deleteAddressAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser("/account/addresses");
  const id = addressIdSchema.safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: copy.addresses.notFound };
  const removed = await deleteAddress(user.id, id.data);
  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return removed
    ? { status: "success", message: copy.addresses.removed }
    : { status: "error", message: copy.addresses.notFound };
}
