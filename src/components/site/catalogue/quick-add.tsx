"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ShoppingBag } from "lucide-react";
import { addToCartAction, type CartActionResult } from "@/app/(site)/cart/actions";
import { Button } from "@/components/ui/button";
import { cart as copy } from "@/content/cart";

const text = copy.quickAdd;

export type QuickAddProps = {
  productId: number;
  name: string;
  /** Minimum order quantity: the quantity one click adds. */
  moq: number;
  outOfStock: boolean;
};

/**
 * "Add to cart" on a product card: adds the minimum order quantity in one
 * click. The server checks MOQ and stock again; its message shows under the
 * button if the product can't be added.
 */
export function QuickAdd({ productId, name, moq, outOfStock }: QuickAddProps) {
  const [result, setResult] = useState<CartActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const added = result?.ok === true;

  if (outOfStock) {
    return (
      <Button size="sm" variant="secondary" disabled className="w-full">
        {text.outOfStock}
      </Button>
    );
  }

  const add = () =>
    startTransition(async () => {
      setResult(await addToCartAction({ productId, quantity: Math.max(1, moq) }));
    });

  return (
    <div>
      <Button
        size="sm"
        variant={added ? "secondary" : "primary"}
        loading={pending}
        icon={added ? <Check aria-hidden className="size-4" /> : <ShoppingBag aria-hidden className="size-4" />}
        aria-label={added ? text.addedLabel(name) : text.buttonLabel(name)}
        onClick={add}
        className="w-full px-3"
      >
        {added ? text.added : text.button}
      </Button>
      <div aria-live="polite" className="text-center text-small">
        {added && (
          <p className="mt-1.5">
            <span className="sr-only">{text.addedLine(name)} </span>
            <Link href="/cart" className="font-extrabold text-brand underline underline-offset-4">
              {text.viewCart}
            </Link>
          </p>
        )}
        {result && !result.ok && (
          <p className="mt-1.5 font-medium text-danger">{result.message}</p>
        )}
      </div>
    </div>
  );
}
