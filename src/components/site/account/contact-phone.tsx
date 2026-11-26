"use client";

import { useActionState, useId } from "react";
import { Phone } from "lucide-react";
import { saveContactPhoneAction } from "@/app/(site)/account/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { verification as copy } from "@/content/verification";
import { formatIndianPhone, normalizeIndianPhone } from "@/lib/phone";
import { idleForm } from "@/server/admin/form";

/**
 * The phone number card next to the document uploads, for types that must
 * give one (clinics and stockists). An account with a sign-in mobile just
 * shows it; otherwise the member types a number our team can call.
 */
export function ContactPhone({
  number,
  fromSignIn,
  locked,
}: {
  number: string | null;
  fromSignIn: boolean;
  locked: boolean;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(saveContactPhoneAction, idleForm);
  const headingId = `${id}-title`;
  const editable = !fromSignIn && !locked;

  return (
    <li
      aria-labelledby={headingId}
      className="flex flex-col rounded-lg border border-line bg-surface p-4 sm:p-5"
    >
      <h3 id={headingId} className="text-base font-extrabold text-ink">
        {copy.phoneLabel}
      </h3>
      <p className="mt-0.5 text-small text-muted">{copy.phone.help}</p>

      {number ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-md bg-surface-alt p-3">
          <Phone aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{formatIndianPhone(number)}</p>
            {fromSignIn && <p className="text-small text-muted">{copy.phone.fromSignIn}</p>}
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-md bg-surface-alt p-3 text-sm font-semibold text-muted">
          {copy.phone.missing}
        </p>
      )}

      {editable && (
        <form action={action} noValidate className="mt-4 flex flex-1 flex-col justify-end gap-3">
          {state.status !== "idle" && state.message && (
            <FormAlert tone={state.status === "success" ? "success" : "error"}>{state.message}</FormAlert>
          )}
          <PhoneInput
            name="phone"
            label={copy.phone.field}
            defaultValue={state.values?.phone ?? (number ? normalizeIndianPhone(number) : "")}
            error={state.fieldErrors?.phone}
            required
          />
          <Button type="submit" variant="secondary" size="sm" loading={pending} className="w-full sm:w-auto sm:self-start">
            {number ? copy.phone.change : copy.phone.save}
          </Button>
        </form>
      )}
    </li>
  );
}
