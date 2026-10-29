"use client";

import { useActionState } from "react";
import { Check, MessageSquareWarning } from "lucide-react";
import { decideProofAction } from "@/app/(site)/my-brand/[id]/actions";
import { TextAreaField, useFormValues } from "@/components/admin/form-fields";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { brand as copy } from "@/content/brand";
import { proofCommentMax } from "@/lib/brand-stage";
import { idleForm } from "@/server/admin/form";

const text = copy.proof;

/**
 * The customer's choice on the latest proof: approve it, or ask for changes
 * with a comment. The server checks the proof is still the one waiting.
 */
export function ProofDecision({ orderId, proofId }: { orderId: string; proofId: number }) {
  const [state, action, pending] = useActionState(decideProofAction, idleForm);
  const values = useFormValues({}, state);
  return (
    <form action={action} aria-label={text.changes} className="flex flex-col gap-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="proofId" value={proofId} />
      <TextAreaField
        name="comment"
        label={text.commentLabel}
        help={text.commentHelp}
        values={values}
        maxLength={proofCommentMax}
        rows={4}
        optional
      />
      <div className="flex flex-wrap gap-3 max-sm:flex-col max-sm:*:w-full">
        <Button
          type="submit"
          name="decision"
          value="approve"
          loading={pending}
          icon={<Check aria-hidden className="size-4.5" />}
        >
          {text.approve}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="changes"
          variant="secondary"
          disabled={pending}
          icon={<MessageSquareWarning aria-hidden className="size-4.5" />}
        >
          {text.send}
        </Button>
      </div>
      <p className="text-small text-muted">{text.approveHelp}</p>
      {state.message && (
        <FormAlert tone={state.status === "error" ? "error" : "success"}>{state.message}</FormAlert>
      )}
    </form>
  );
}
