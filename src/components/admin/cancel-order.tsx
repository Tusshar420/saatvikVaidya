"use client";

import { useActionState, useState } from "react";
import { Ban } from "lucide-react";
import { cancelOrderAction } from "@/app/admin/orders/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { Modal, ModalContent, ModalTrigger } from "@/components/ui/modal";
import { admin as copy } from "@/content/admin";
import { idleForm, type FormState } from "@/server/admin/form";
import { dangerButtonClasses } from "./confirm-delete";

const text = copy.orderDetail;

/** "Cancel order", confirmed in a dialog with an optional reason for the audit log. */
export function CancelOrder({
  orderId,
  number,
  allowed,
  restock,
}: {
  orderId: string;
  number: string;
  /** False once the order has shipped or closed: only the reason shows. */
  allowed: boolean;
  /** Whether cancelling puts stock back (the order was paid). */
  restock: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (previous: FormState, formData: FormData) => {
      const result = await cancelOrderAction(previous, formData);
      setOpen(false);
      return result;
    },
    idleForm,
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        {allowed ? text.cancelIntro : text.cancelNotAllowed}
      </p>
      {allowed && (
        <Modal open={open} onOpenChange={setOpen}>
          <ModalTrigger asChild>
            <Button
              variant="secondary"
              icon={<Ban aria-hidden className="size-4" />}
              className={`${dangerButtonClasses} self-start max-sm:w-full`}
            >
              {text.cancel}
            </Button>
          </ModalTrigger>
          <ModalContent
            title={text.cancelConfirmTitle(number)}
            description={text.cancelConfirmBody(restock)}
          >
            <form action={action} className="flex flex-col gap-4">
              <input type="hidden" name="orderId" value={orderId} />
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-extrabold text-ink">
                  {text.cancelNote}
                </span>
                <input
                  name="note"
                  maxLength={500}
                  placeholder={text.cancelNotePlaceholder}
                  className={inputClasses}
                />
              </label>
              <div className="flex flex-wrap gap-3 max-sm:*:w-full">
                <Button
                  type="submit"
                  variant="secondary"
                  loading={pending}
                  className={dangerButtonClasses}
                >
                  {text.cancelConfirm}
                </Button>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  {text.keep}
                </Button>
              </div>
            </form>
          </ModalContent>
        </Modal>
      )}
      {state.message && (
        <FormAlert tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormAlert>
      )}
    </div>
  );
}
