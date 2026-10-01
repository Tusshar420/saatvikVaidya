"use client";

import { useActionState } from "react";
import { adjustCoinsAction } from "@/app/admin/coins/actions";
import { FormError, TextField, useFormValues } from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";
import { idleForm } from "@/server/admin/form";

const text = copy.userDetail.coins;

/** A manual coin credit or debit with a required reason. */
export function AdjustCoinsForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(adjustCoinsAction, idleForm);
  const values = useFormValues({ amount: "", note: "" }, state);
  return (
    <form action={action} noValidate className="mt-4 flex flex-col gap-4">
      <h3 className="text-base font-extrabold text-ink">{text.adjustTitle}</h3>
      <input type="hidden" name="userId" value={userId} />
      <TextField
        key={state.status === "success" ? `done-${state.message}` : "form"}
        name="amount"
        label={text.amountLabel}
        help={text.amountHelp}
        values={values}
        inputMode="numeric"
        maxLength={8}
        required
      />
      <TextField
        key={state.status === "success" ? `done-note-${state.message}` : "note"}
        name="note"
        label={text.noteLabel}
        help={text.noteHelp}
        values={values}
        maxLength={300}
        required
      />
      <div role="status" aria-live="polite" className="empty:hidden">
        <FormError state={state} />
        {state.status === "success" && <p className="text-sm font-bold text-green">{state.message}</p>}
      </div>
      <Button type="submit" variant="secondary" loading={pending} className="self-start max-sm:w-full">
        {text.submit}
      </Button>
    </form>
  );
}
