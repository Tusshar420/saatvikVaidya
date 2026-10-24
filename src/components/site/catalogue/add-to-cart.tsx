"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { addToCartAction, type CartActionResult } from "@/app/(site)/cart/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { QuantityStepper } from "@/components/site/cart/quantity-stepper";
import { Button } from "@/components/ui/button";
import { cart as copy } from "@/content/cart";
import { MAX_QUANTITY_INPUT } from "@/lib/orders";

const text = copy.add;

export type AddToCartProps = {
  productId: number;
  name: string;
  /** Minimum order quantity: the starting quantity. */
  moq: number;
  /** Units left when stock is low; otherwise unknown here (the server checks). */
  left: number | null;
  outOfStock: boolean;
  phone: string;
};

/**
 * Quantity and "Add to cart" on the product page. The server checks MOQ and
 * stock again and answers with a message if the quantity can't be added.
 * One per page (fixed ids).
 */
export function AddToCart({ productId, name, moq, left, outOfStock, phone }: AddToCartProps) {
  const [quantity, setQuantity] = useState(moq);
  const [result, setResult] = useState<CartActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (outOfStock) {
    return (
      <div className="flex flex-col gap-2">
        <Button disabled aria-describedby="add-to-cart-note" className="max-sm:w-full">
          {text.outOfStock}
        </Button>
        <p id="add-to-cart-note" className="text-small text-muted">
          {text.outOfStockLine(phone)}
        </p>
      </div>
    );
  }

  const add = () =>
    startTransition(async () => {
      setResult(await addToCartAction({ productId, quantity }));
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="add-to-cart-quantity" className="text-xs font-extrabold text-ink">
            {text.quantity}
          </label>
          <QuantityStepper
            id="add-to-cart-quantity"
            look="joined"
            className="w-40"
            label={copy.line.quantityFor(name)}
            decreaseLabel={copy.line.decrease(name)}
            increaseLabel={copy.line.increase(name)}
            value={quantity}
            min={moq}
            max={left ?? MAX_QUANTITY_INPUT}
            onCommit={(value) => {
              setQuantity(value);
              setResult(null);
            }}
          />
        </div>
        <Button loading={pending} onClick={add} className="max-sm:w-full">
          {text.button}
        </Button>
      </div>
      <div aria-live="polite">
        {result?.ok && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-brand-soft px-3.5 py-3 text-sm font-medium text-brand-dark">
            <CircleCheck aria-hidden className="size-4.5 shrink-0" />
            <span>{text.addedLine(name)}</span>
            <Link href="/cart" className="font-extrabold text-brand underline underline-offset-4">
              {text.viewCart}
            </Link>
          </p>
        )}
      </div>
      {result && !result.ok && <FormAlert>{result.message}</FormAlert>}
    </div>
  );
}
