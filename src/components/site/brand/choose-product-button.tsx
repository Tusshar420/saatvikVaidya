"use client";

import { useActionState } from "react";
import { chooseProductAction } from "@/app/(site)/launch/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { brand as copy } from "@/content/brand";
import { idleForm } from "@/server/admin/form";

/** Step 1's "Choose" for one product: saves it on the draft and opens step 2. */
export function ChooseProductButton({
  productId,
  productName,
  chosen,
}: {
  productId: number;
  productName: string;
  chosen: boolean;
}) {
  const [state, action, pending] = useActionState(chooseProductAction, idleForm);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="productId" value={productId} />
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        loading={pending}
        aria-label={chosen ? copy.product.chosenLabel(productName) : copy.product.chooseLabel(productName)}
        className="w-full"
      >
        {chosen ? copy.product.chosen : copy.product.choose}
      </Button>
    </form>
  );
}
