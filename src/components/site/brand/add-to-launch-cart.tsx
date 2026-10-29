"use client";

import { useState, useTransition } from "react";
import { Plus, ShoppingBag } from "lucide-react";
import { addToBrandCartAction } from "@/app/(site)/launch/actions";
import { Button } from "@/components/ui/button";
import { brand as copy } from "@/content/brand";

const text = copy.product;

/**
 * Step 1's button on a product card: adds the product's minimum to the
 * Launch cart, or one more step of the minimum when it's already there. The
 * page (and the cart bar) refresh from the server after each add; a refusal
 * shows under the button.
 */
export function AddToLaunchCart({
  productId,
  productName,
  minQty,
  unitLabel,
  inCart,
}: {
  productId: number;
  productName: string;
  minQty: number;
  unitLabel: string;
  /** Units of this product already in the cart, or null. */
  inCart: number | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      const result = await addToBrandCartAction({ productId });
      setError(result.ok ? null : result.message);
    });

  return (
    <div className="flex flex-col gap-1.5">
      <div aria-live="polite" className="text-small">
        {inCart !== null && (
          <p className="font-bold text-brand">{text.inCartLine(inCart, unitLabel)}</p>
        )}
        {error && <p className="font-medium text-danger">{error}</p>}
      </div>
      <Button
        type="button"
        variant="dark"
        size="sm"
        loading={pending}
        icon={inCart === null ? <ShoppingBag aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
        aria-label={inCart === null ? text.addLabel(productName) : text.addMoreLabel(productName, minQty)}
        onClick={add}
        className="h-11 w-full rounded-sm px-3"
      >
        {inCart === null ? text.add : text.addMore(minQty)}
      </Button>
    </div>
  );
}
