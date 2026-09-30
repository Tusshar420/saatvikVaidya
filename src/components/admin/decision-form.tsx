"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { decideUserAction } from "@/app/admin/users/actions";
import { admin as copy } from "@/content/admin";
import { cn } from "@/lib/cn";
import { idleForm, type FormState } from "@/server/admin/form";
import { dangerButtonClasses } from "./confirm-delete";

export type DecisionFormProps = {
  userId: string;
  /** Used in accessible names so each row's buttons are distinct. */
  name: string;
  /** Compact: one line in the approvals list. */
  compact?: boolean;
  className?: string;
};

/** Approve or reject one account, with an optional comment. */
export function DecisionForm({
  userId,
  name,
  compact = false,
  className,
}: DecisionFormProps) {
  const toast = useToast();
  // In the approvals list the row disappears once decided (and its message
  // with it), so the result is also shown as a toast.
  const [state, action, pending] = useActionState(
    async (previous: FormState, formData: FormData) => {
      const result = await decideUserAction(previous, formData);
      if (compact && result.status === "success" && result.message) {
        toast({ title: result.message, description: name });
      }
      return result;
    },
    idleForm,
  );
  const noteId = `note-${userId}`;

  return (
    <form action={action} className={cn("flex flex-col gap-3", className)}>
      <input type="hidden" name="id" value={userId} />
      <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
        <label htmlFor={noteId} className={cn(compact && "sr-only")}>
          <span className="text-xs font-extrabold text-ink">
            {compact
              ? copy.approvals.commentLabel(name)
              : copy.userDetail.decide.noteLabel}
          </span>
        </label>
        <input
          id={noteId}
          name="note"
          maxLength={500}
          placeholder={
            compact
              ? copy.approvals.commentPlaceholder
              : copy.userDetail.decide.notePlaceholder
          }
          className={cn(inputClasses, compact && "md:h-10")}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="submit"
            name="decision"
            value="approved"
            size="sm"
            loading={pending}
            icon={<Check aria-hidden className="size-4" />}
            aria-label={copy.approvals.approveNamed(name)}
          >
            {copy.userDetail.decide.approve}
          </Button>
          <Button
            type="submit"
            name="decision"
            value="rejected"
            size="sm"
            variant="secondary"
            disabled={pending}
            icon={<X aria-hidden className="size-4" />}
            aria-label={copy.approvals.rejectNamed(name)}
            className={dangerButtonClasses}
          >
            {copy.userDetail.decide.reject}
          </Button>
        </div>
      </div>
      {state.message && (
        <FormAlert tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormAlert>
      )}
    </form>
  );
}
