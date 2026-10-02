"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { saveQuantityAction } from "@/app/(site)/launch/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { OrderSummary } from "@/components/site/cart/order-summary";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { brand as copy } from "@/content/brand";
import {
  maxBrandQuantity,
  snapBrandQuantity,
  stepBrandQuantity,
  type BrandTerms,
} from "@/lib/brand";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import { idleForm } from "@/server/admin/form";
import { computeTotals, type ShippingRule } from "@/server/checkout/totals";

const text = copy.quantity;

/**
 * Step 3: the quantity. It starts at the minimum; + adds the minimum and −
 * takes it off, never below the minimum. A typed number moves to the next
 * allowed one when the field is left. Price, GST and total follow along;
 * the server checks the step and the price again.
 */
export function QuantityForm({
  productName,
  terms,
  gstRate,
  shipping,
  initial,
}: {
  productName: string;
  terms: BrandTerms;
  gstRate: number;
  shipping: ShippingRule;
  initial: number | null;
}) {
  const [state, action, pending] = useActionState(saveQuantityAction, idleForm);
  const [quantity, setQuantity] = useState(() => snapBrandQuantity(initial ?? terms.minQty, terms));
  const [draft, setDraft] = useState(String(quantity));
  const [note, setNote] = useState<string | null>(null);
  const max = maxBrandQuantity(terms);
  const { minQty, unitLabel } = terms;

  const set = (next: number, message: string | null = null) => {
    setQuantity(next);
    setDraft(String(next));
    setNote(message);
  };
  const commitDraft = () => {
    const typed = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(typed)) {
      set(quantity);
      return;
    }
    const next = snapBrandQuantity(Math.floor(typed), terms);
    let message: string | null = null;
    if (next !== typed) message = next === max && typed > max ? text.max(max) : text.snapped(next, minQty);
    set(next, message);
  };

  const lineTotalPaise = terms.unitPricePaise * quantity;
  const totals = computeTotals([{ lineTotalPaise, gstRate }], shipping);

  return (
    <form
      action={action}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8"
    >
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <p id="quantity-rule" className="text-body text-ink">
          {text.line(minQty, unitLabel)}
        </p>
        <div>
          <label htmlFor="brand-quantity" className="mb-1.5 block text-xs font-extrabold text-ink">
            {text.field(unitLabel)}
          </label>
          <div className="flex items-center gap-2">
            <IconButton
              label={text.decrease(minQty)}
              variant="outline"
              disabled={quantity <= minQty}
              onClick={() => set(stepBrandQuantity(quantity, terms, "down"))}
            >
              <Minus aria-hidden />
            </IconButton>
            <input
              id="brand-quantity"
              type="number"
              inputMode="numeric"
              name="quantity"
              min={minQty}
              max={max}
              step={minQty}
              value={draft}
              aria-describedby={note ? "quantity-rule quantity-note" : "quantity-rule"}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitDraft();
                }
              }}
              className={cn(
                inputClasses,
                "h-11 w-28 px-1 text-center font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
              )}
            />
            <IconButton
              label={text.increase(minQty)}
              variant="outline"
              disabled={quantity >= max}
              onClick={() => set(stepBrandQuantity(quantity, terms, "up"))}
            >
              <Plus aria-hidden />
            </IconButton>
          </div>
          <p id="quantity-note" role="status" className="mt-2 min-h-5 text-small font-medium text-orange-ink">
            {note}
          </p>
        </div>
        {state.status === "error" && state.message && <FormAlert>{state.message}</FormAlert>}
        <div className="flex flex-wrap items-center gap-3 max-sm:flex-col-reverse max-sm:*:w-full">
          <Link href="/launch?step=2" className={buttonClasses({ variant: "secondary" })}>
            {copy.launch.back}
          </Link>
          <Button type="submit" loading={pending} arrow>
            {copy.launch.continue}
          </Button>
        </div>
      </div>

      <OrderSummary
        title={text.summaryLabel}
        totals={totals}
        items={[
          {
            key: "brand",
            name: productName,
            detail: copy.review.itemDetail(quantity, unitLabel, formatPaise(terms.unitPricePaise)),
            totalPaise: lineTotalPaise,
          },
        ]}
        itemsLabel={text.summaryLabel}
        hideNote
        className="lg:sticky lg:top-40"
      />
    </form>
  );
}
