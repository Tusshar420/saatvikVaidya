"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addToCartAction, type CartActionResult } from "@/app/(site)/cart/actions";
import { home as copy } from "@/content/home";
import { cn } from "@/lib/cn";

const text = copy.brands;

/** The Top Brands card's "Min. N units · Add +" row: adds the minimum to the store cart. */
export function HomeAddToCart({
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
  const qty = Math.max(1, moq);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">{text.min(qty)}</span>
        <button
          type="button"
          disabled={outOfStock || pending}
          aria-busy={pending || undefined}
          aria-label={text.addLabel(name)}
          onClick={() =>
            startTransition(async () => {
              setResult(await addToCartAction({ productId, quantity: qty }));
            })
          }
          className={cn(
            "min-h-11 rounded-sm px-3 text-xs font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-60",
            added ? "bg-success" : "bg-brand hover:bg-brand-mid",
          )}
        >
          {added ? text.added : text.add}
        </button>
      </div>
      <div aria-live="polite" className="text-[11px]">
        {added && (
          <Link href="/cart" className="mt-1 block text-right font-extrabold text-brand underline underline-offset-4">
            {text.viewCart}
          </Link>
        )}
        {result && !result.ok && <p className="mt-1 mb-0 text-danger">{result.message}</p>}
      </div>
    </div>
  );
}
