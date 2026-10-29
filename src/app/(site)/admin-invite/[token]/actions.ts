"use server";

import { adminSecurity as copy } from "@/content/admin-security";
import { acceptInvite } from "@/server/admin/admins";
import { formValues, type FormState } from "@/server/admin/form";
import { rateLimitRules } from "@/server/auth/policy";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { requestIp } from "@/server/request-origin";

/**
 * Creates the admin account from an invitation link. Public (the invitee has
 * no account yet), so it is limited per IP like sign-in, and every failure
 * of the link itself gets the same message.
 */
export async function acceptInviteAction(
  token: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const limit = await hitRateLimit(rateLimitRules.signInPerIp, await requestIp());
  if (!limit.allowed) return { status: "error", message: copy.errors.tooMany };
  const values = formValues(formData);
  const result = await acceptInvite(token, {
    name: values.name ?? "",
    password: values.password ?? "",
    confirm: values.confirm ?? "",
  });
  if (!result.ok) {
    return {
      status: "error",
      message: result.field ? undefined : result.error,
      fieldErrors: result.field ? { [result.field]: result.error } : undefined,
      values: { name: values.name ?? "" },
    };
  }
  return { status: "success", message: copy.invite.page.done };
}
