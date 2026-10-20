"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { MapPin, Plus } from "lucide-react";
import { placeOrderAction, saveAddressAction } from "@/app/(site)/checkout/actions";
import { AddressForm } from "@/components/site/address-form";
import { FormAlert } from "@/components/site/auth/form-alert";
import { OrderSummary, type OrderSummaryProps } from "@/components/site/cart/order-summary";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { checkout as copy } from "@/content/checkout";
import { coins as coinCopy } from "@/content/coins";
import { formatPaise } from "@/lib/format";
import { addressLines, addressPhone } from "@/lib/address";
import { cn } from "@/lib/cn";
import { idleForm, type FormState } from "@/server/admin/form";
import type { SavedAddress } from "@/server/checkout/addresses";

const text = copy.address;

export type CheckoutFormProps = {
  addresses: SavedAddress[];
  checkoutKey: string;
  totals: OrderSummaryProps["totals"];
  items: NonNullable<OrderSummaryProps["items"]>;
  /** Coins the buyer could use on this order; null when none or the programme is off. */
  coinOffer: {
    balance: number;
    coins: number;
    discountPaise: number;
    totals: OrderSummaryProps["totals"];
  } | null;
  /** Shown instead of "Place order" when online payment can't be taken. */
  paymentsOff: ReactNode | null;
  /**
   * For Launch Your Brand's review step (P2.1): its own place and
   * save-address actions and button text. The store's are the defaults.
   */
  placeAction?: (state: FormState, formData: FormData) => Promise<FormState>;
  saveAddress?: typeof saveAddressAction;
  placeLabel?: string;
  placeNote?: string;
};

/**
 * The checkout: pick, add or edit a delivery address, then place the order.
 * Only the address id, a random checkout key and the total shown here are
 * sent; the server prices everything again.
 */
export function CheckoutForm({
  addresses,
  checkoutKey,
  totals: plainTotals,
  items,
  coinOffer,
  paymentsOff,
  placeAction: placeOrder = placeOrderAction,
  saveAddress = saveAddressAction,
  placeLabel = copy.place.button,
  placeNote = copy.place.note,
}: CheckoutFormProps) {
  const [useCoins, setUseCoins] = useState(false);
  const canUseCoins = coinOffer !== null && coinOffer.coins > 0;
  const totals = useCoins && canUseCoins ? coinOffer.totals : plainTotals;
  const [selected, setSelected] = useState<number | null>(addresses[0]?.id ?? null);
  const [editing, setEditing] = useState<"new" | number | null>(
    addresses.length === 0 ? "new" : null,
  );
  const [placeState, placeAction, placing] = useActionState(placeOrder, idleForm);
  const chosen = addresses.some((address) => address.id === selected) ? selected : null;

  // Closing the address form removes the focused element with it; move focus
  // to the saved address (or the "Add" button) once it's on the page, rather
  // than letting it fall back to the top of the document.
  const focusAfterForm = useRef<string | null>(null);
  useEffect(() => {
    if (editing !== null || focusAfterForm.current === null) return;
    const target = document.getElementById(focusAfterForm.current);
    if (target) {
      target.focus();
      focusAfterForm.current = null;
    }
  }, [editing, addresses]);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8">
      <section
        aria-labelledby="checkout-address"
        className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
      >
        <h2 id="checkout-address" className="flex items-center gap-2.5 text-h3 text-ink">
          <MapPin aria-hidden className="size-5 text-brand" />
          {copy.steps.address}
        </h2>

        {addresses.length === 0 ? (
          <p className="mt-2 text-body text-muted">{text.none}</p>
        ) : (
          <fieldset className="mt-4">
            <legend className="sr-only">{text.pickLabel}</legend>
            <ul className="flex flex-col gap-3">
              {addresses.map((address) => {
                const active = chosen === address.id;
                return (
                  <li
                    key={address.id}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-1 transition",
                      active ? "border-brand bg-brand-soft/50" : "border-line",
                    )}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 p-3">
                      <input
                        id={`address-choice-${address.id}`}
                        type="radio"
                        name="address-choice"
                        value={address.id}
                        checked={active}
                        onChange={() => setSelected(address.id)}
                        className="mt-1 size-4.5 shrink-0 accent-brand"
                      />
                      <span className="min-w-0 text-sm">
                        <span className="block font-extrabold text-ink">{address.name}</span>
                        {addressLines(address).map((line) => (
                          <span key={line} className="block text-ink">
                            {line}
                          </span>
                        ))}
                        <span className="mt-1 block text-small text-muted">
                          {text.phoneLine(addressPhone(address))}
                        </span>
                      </span>
                    </label>
                    <Button
                      variant="link"
                      size="sm"
                      aria-label={text.editLabel(address.name)}
                      onClick={() => setEditing(address.id)}
                      className="mt-1.5 mr-1"
                    >
                      {text.edit}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        <div className="mt-5">
          {editing === null ? (
            <Button
              id="address-add"
              variant="secondary"
              icon={<Plus aria-hidden className="size-4" />}
              onClick={() => setEditing("new")}
              className="max-sm:w-full"
            >
              {text.add}
            </Button>
          ) : (
            <AddressForm
              key={editing}
              action={saveAddress}
              address={
                editing === "new"
                  ? null
                  : (addresses.find((address) => address.id === editing) ?? null)
              }
              onSaved={(id) => {
                focusAfterForm.current = `address-choice-${id}`;
                setSelected(id);
                setEditing(null);
              }}
              onCancel={
                addresses.length > 0
                  ? () => {
                      focusAfterForm.current = "address-add";
                      setEditing(null);
                    }
                  : undefined
              }
            />
          )}
        </div>
      </section>

      <OrderSummary
        totals={totals}
        items={items}
        itemsLabel={copy.summary.title}
        className="lg:sticky lg:top-40"
      >
        {paymentsOff ?? (
          <form action={placeAction} className="flex flex-col gap-3">
            <input type="hidden" name="addressId" value={chosen ?? ""} />
            <input type="hidden" name="checkoutKey" value={checkoutKey} />
            <input type="hidden" name="expectedTotalPaise" value={totals.totalPaise} />
            {coinOffer && (
              <div className="rounded-lg border border-line bg-surface-alt px-3 py-1">
                {canUseCoins ? (
                  <Checkbox
                    name="redeemCoins"
                    checked={useCoins}
                    onChange={(event) => setUseCoins(event.target.checked)}
                    help={coinCopy.checkout.help(coinOffer.balance)}
                  >
                    {coinCopy.checkout.label(coinOffer.coins, formatPaise(coinOffer.discountPaise))}
                  </Checkbox>
                ) : (
                  <p className="py-2.5 text-small text-muted">{coinCopy.checkout.none(coinOffer.balance)}</p>
                )}
              </div>
            )}
            {placeState.status === "error" && <FormAlert>{placeState.message}</FormAlert>}
            {chosen === null && (
              <p id="place-needs-address" className="text-small font-bold text-orange-ink">
                {copy.place.needAddress}
              </p>
            )}
            <Button
              type="submit"
              loading={placing}
              disabled={chosen === null}
              aria-describedby={chosen === null ? "place-needs-address" : undefined}
              arrow
              className="w-full"
            >
              {placeLabel}
            </Button>
            <p className="text-small text-muted">{placeNote}</p>
          </form>
        )}
      </OrderSummary>
    </div>
  );
}
