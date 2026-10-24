"use client";

import { useActionState } from "react";
import { BadgeCheck } from "lucide-react";
import { markPaidAction } from "@/app/admin/orders/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";
import { idleForm } from "@/server/admin/form";

const text = copy.orderDetail.markPaid;

/** "Mark as paid" for an order waiting for a QR or bank-transfer payment. */
export function MarkPaid({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(markPaidAction, idleForm);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-orange/60 bg-orange-soft/50 p-4">
      <input type="hidden" name="orderId" value={orderId} />
      <h3 className="text-base font-extrabold text-ink">{text.title}</h3>
      <p className="text-sm text-muted">{text.line}</p>
      <Button
        type="submit"
        loading={pending}
        icon={<BadgeCheck aria-hidden className="size-4" />}
        className="self-start max-sm:w-full"
      >
        {text.button}
      </Button>
      {state.message && (
        <FormAlert tone={state.status === "error" ? "error" : "success"}>{state.message}</FormAlert>
      )}
    </form>
  );
}
