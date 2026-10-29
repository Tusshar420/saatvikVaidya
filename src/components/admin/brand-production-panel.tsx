"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { advanceStageAction } from "@/app/admin/brand-orders/[id]/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { brand as copy } from "@/content/brand";
import { type BrandStageKey } from "@/lib/brand-stage";
import { idleForm } from "@/server/admin/form";

const text = copy.admin.detail;

/**
 * "Update status" for a brand order: one button that moves it to the stage
 * that follows the one the admin sees (it sends that stage, so a double
 * click moves the order once).
 */
export function BrandProductionPanel({
  orderId,
  stage,
  next,
}: {
  orderId: string;
  stage: BrandStageKey;
  next: "in_production" | "quality_check" | "dispatched" | "delivered";
}) {
  const [state, action, pending] = useActionState(advanceStageAction, idleForm);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="from" value={stage} />
      <input type="hidden" name="to" value={next} />
      <Button
        type="submit"
        loading={pending}
        icon={<ArrowRight aria-hidden className="size-4.5" />}
        className="self-start max-sm:w-full"
      >
        {text.updateStatus(copy.detail.stageLabels[next])}
      </Button>
      {state.message && (
        <FormAlert tone={state.status === "error" ? "error" : "success"}>{state.message}</FormAlert>
      )}
    </form>
  );
}
