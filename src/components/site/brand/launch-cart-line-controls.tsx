"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  removeFromBrandCartAction,
  setBrandCartQuantityAction,
} from "@/app/(site)/launch/actions";
import { QuantityStepper } from "@/components/site/cart/quantity-stepper";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { brand as copy } from "@/content/brand";
import { maxBrandQuantity, snapBrandQuantity, type QuantityTerms } from "@/lib/brand";

const text = copy.cart;

/**
 * Quantity and remove for one Launch cart line. − and + move by the
 * product's minimum; a typed number moves up to the next multiple (with a
 * note saying so). The page refreshes from the server after each change, so
 * prices, bulk tiers and totals stay the server's.
 */
export function LaunchCartLineControls({
  productId,
  name,
  quantity,
  terms,
  unitLabel,
  removeOnly,
  describedBy,
}: {
  productId: number;
  name: string;
  quantity: number;
  terms: QuantityTerms | null;
  unitLabel: string;
  /** No longer available: only removing is possible. */
  removeOnly: boolean;
  describedBy?: string;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  // Set while a typed number is being committed after it was moved.
  const adjusted = useRef(false);
  const noteId = `launch-note-${productId}`;

  const setQuantity = (value: number) =>
    startTransition(async () => {
      const result = await setBrandCartQuantityAction({ productId, quantity: value });
      if (!result.ok) toast({ tone: "error", title: result.message });
    });

  const remove = () =>
    startTransition(async () => {
      const result = await removeFromBrandCartAction({ productId });
      if (result.ok) toast({ title: text.removed, description: name });
      else toast({ tone: "error", title: result.message });
    });

  const max = terms ? maxBrandQuantity(terms) : quantity;
  return (
    <div className="flex flex-col gap-1.5" aria-busy={pending || undefined}>
      <div className="flex flex-wrap items-center gap-2">
        {!removeOnly && terms && (
          <QuantityStepper
            id={`launch-quantity-${productId}`}
            label={text.quantityFor(name, unitLabel)}
            decreaseLabel={text.decrease(name, terms.minQty)}
            increaseLabel={text.increase(name, terms.minQty)}
            value={quantity}
            min={terms.minQty}
            max={Math.max(terms.minQty, max)}
            step={terms.minQty}
            normalize={(typed) => snapBrandQuantity(Math.floor(typed), terms)}
            onAdjusted={(typed, value) => {
              adjusted.current = value !== quantity;
              setNote(value === max && typed > max ? text.max(max) : text.snapped(value, terms.minQty));
            }}
            onCommit={(value) => {
              if (!adjusted.current) setNote(null);
              adjusted.current = false;
              setQuantity(value);
            }}
            disabled={pending}
            describedBy={[describedBy, note ? noteId : null].filter(Boolean).join(" ") || undefined}
            className="[&_input]:w-24"
          />
        )}
        <Button
          variant="link"
          size="sm"
          disabled={pending}
          aria-label={text.removeLabel(name)}
          icon={<Trash2 aria-hidden className="size-4" />}
          onClick={remove}
        >
          {text.remove}
        </Button>
      </div>
      <p id={noteId} role="status" className="text-small font-medium text-orange-ink">
        {note}
      </p>
    </div>
  );
}
