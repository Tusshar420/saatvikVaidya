"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  removeFromCartAction,
  setCartQuantityAction,
} from "@/app/(site)/cart/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cart as copy } from "@/content/cart";
import { MAX_QUANTITY_INPUT } from "@/lib/orders";
import { QuantityStepper } from "./quantity-stepper";

export type CartLineControlsProps = {
  productId: number;
  name: string;
  quantity: number;
  moq: number;
  available: number;
  /** Unavailable or out of stock: only removing is possible. */
  removeOnly: boolean;
  describedBy?: string;
};

/** Quantity and remove for one cart line. The page refreshes after each change. */
export function CartLineControls({
  productId,
  name,
  quantity,
  moq,
  available,
  removeOnly,
  describedBy,
}: CartLineControlsProps) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const setQuantity = (value: number) =>
    startTransition(async () => {
      const result = await setCartQuantityAction({ productId, quantity: value });
      if (!result.ok) toast({ tone: "error", title: result.message });
    });

  const remove = () =>
    startTransition(async () => {
      const result = await removeFromCartAction({ productId });
      if (result.ok) toast({ title: copy.removed, description: name });
      else toast({ tone: "error", title: result.message });
    });

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending || undefined}>
      {!removeOnly && (
        <QuantityStepper
          id={`quantity-${productId}`}
          look="joined"
          className="w-36"
          label={copy.line.quantityFor(name)}
          decreaseLabel={copy.line.decrease(name)}
          increaseLabel={copy.line.increase(name)}
          value={quantity}
          min={moq}
          max={Math.min(Math.max(available, moq), MAX_QUANTITY_INPUT)}
          disabled={pending}
          onCommit={setQuantity}
          describedBy={describedBy}
        />
      )}
      <Button
        variant="link"
        size="sm"
        disabled={pending}
        aria-label={copy.line.removeLabel(name)}
        icon={<Trash2 aria-hidden className="size-4" />}
        onClick={remove}
      >
        {copy.line.remove}
      </Button>
    </div>
  );
}
