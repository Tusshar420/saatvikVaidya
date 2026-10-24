"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { addToCartAction, type CartActionResult } from "@/app/(site)/cart/actions";
import { QuantityStepper } from "@/components/site/cart/quantity-stepper";
import { Spinner } from "@/components/ui/spinner";
import { cart as copy } from "@/content/cart";
import { cn } from "@/lib/cn";
import { MAX_QUANTITY_INPUT } from "@/lib/orders";

const text = copy.quickAdd;

export type QuickAddProps = {
  productId: number;
  name: string;
  /** Minimum order quantity: where the stepper starts. */
  moq: number;
  outOfStock: boolean;
};

/**
 * The v2 card's "− 3 + | Add to Order" row: a stepper that starts at the
 * minimum order and goes up one unit at a time, and the button that adds that
 * quantity. The server checks MOQ and stock again; its message shows under the
 * row if the product can't be added.
 */
export function QuickAdd({ productId, name, moq, outOfStock }: QuickAddProps) {
  const min = Math.max(1, moq);
  const [quantity, setQuantity] = useState(min);
  const [result, setResult] = useState<CartActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();
  const added = result?.ok === true;

  const add = () =>
    startTransition(async () => {
      setResult(await addToCartAction({ productId, quantity }));
    });

  const buttonClasses =
    "inline-flex h-11 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-2 font-heading text-small font-extrabold transition disabled:cursor-not-allowed";

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-1.75">
        <QuantityStepper
          id={`${id}-qty`}
          look="joined"
          label={text.quantityFor(name)}
          decreaseLabel={text.decrease(name)}
          increaseLabel={text.increase(name)}
          value={quantity}
          min={min}
          max={MAX_QUANTITY_INPUT}
          disabled={outOfStock || pending}
          onCommit={setQuantity}
        />
        {outOfStock ? (
          <button type="button" disabled className={cn(buttonClasses, "bg-surface-alt text-muted")}>
            {text.outOfStock}
          </button>
        ) : (
          <button
            type="button"
            aria-label={added ? text.addedLabel(name) : text.buttonLabel(name)}
            aria-busy={pending || undefined}
            disabled={pending}
            onClick={add}
            className={cn(
              buttonClasses,
              added
                ? "border border-brand bg-brand-soft text-brand hover:bg-surface"
                : "bg-brand text-white hover:bg-brand-dark motion-safe:hover:-translate-y-0.5",
            )}
          >
            {pending ? (
              <Spinner className="size-4" />
            ) : (
              added && <Check aria-hidden className="size-4 shrink-0" />
            )}
            <span className="truncate">{added ? text.added : text.button}</span>
          </button>
        )}
      </div>
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
