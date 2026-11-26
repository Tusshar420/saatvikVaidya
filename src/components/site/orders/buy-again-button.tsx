"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addToCartAction, type CartActionResult } from "@/app/(site)/cart/actions";
import { orders as copy } from "@/content/orders";
import { cn } from "@/lib/cn";

const text = copy.buyAgain;

/** A "Buy again" card's button: adds the product's minimum order to the cart. */
export function BuyAgainButton({
  productId,
  name,
  moq,
  outOfStock,
}: {
  productId: number;
  name: string;
  moq: number;
  outOfStock: boolean;
}) {
  const [result, setResult] = useState<CartActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const added = result?.ok === true;

  return (
    <div>
      <button
        type="button"
        disabled={outOfStock || pending}
        aria-busy={pending || undefined}
        aria-label={outOfStock ? undefined : text.addLabel(name)}
        onClick={() =>
          startTransition(async () => {
            setResult(await addToCartAction({ productId, quantity: moq }));
          })
        }
        className={cn(
          "min-h-11 w-full rounded-sm px-3 text-small font-extrabold transition disabled:cursor-not-allowed",
          outOfStock
            ? "border border-line bg-cream text-muted"
            : added
              ? "bg-success text-white"
              : "bg-brand text-white hover:bg-brand-mid disabled:opacity-60",
        )}
      >
        {outOfStock ? text.outOfStock : added ? text.added : text.add}
      </button>
      <div aria-live="polite" className="text-[11px]">
        {added && (
          <Link href="/cart" className="mt-1 block text-center font-extrabold text-brand underline underline-offset-4">
            {text.viewCart}
          </Link>
        )}
        {result && !result.ok && <p className="mt-1 mb-0 text-danger">{result.message}</p>}
      </div>
    </div>
  );
}
