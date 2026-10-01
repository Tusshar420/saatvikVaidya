"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { MapPin, Plus } from "lucide-react";
import {
  placeOrderAction,
  saveAddressAction,
  type AddressFormState,
} from "@/app/(site)/checkout/actions";
import { SelectField, TextField, useFormValues } from "@/components/admin/form-fields";
import { FormAlert } from "@/components/site/auth/form-alert";
import { OrderSummary, type OrderSummaryProps } from "@/components/site/cart/order-summary";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { checkout as copy } from "@/content/checkout";
import { addressLines, addressPhone } from "@/lib/address";
import { cn } from "@/lib/cn";
import { indianStates } from "@/lib/india";
import { idleForm } from "@/server/admin/form";
import type { SavedAddress } from "@/server/checkout/addresses";

const text = copy.address;

export type CheckoutFormProps = {
  addresses: SavedAddress[];
  checkoutKey: string;
  totals: OrderSummaryProps["totals"];
  items: NonNullable<OrderSummaryProps["items"]>;
  /** Shown instead of "Place order" when online payment can't be taken. */
  paymentsOff: ReactNode | null;
};

/**
 * The checkout: pick, add or edit a delivery address, then place the order.
 * Only the address id, a random checkout key and the total shown here are
 * sent; the server prices everything again.
 */
export function CheckoutForm({
  addresses,
  checkoutKey,
  totals,
  items,
  paymentsOff,
}: CheckoutFormProps) {
  const [selected, setSelected] = useState<number | null>(addresses[0]?.id ?? null);
  const [editing, setEditing] = useState<"new" | number | null>(
    addresses.length === 0 ? "new" : null,
  );
  const [placeState, placeAction, placing] = useActionState(placeOrderAction, idleForm);
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
          <MapPin aria-hidden className="size-5 text-teal" />
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
                      active ? "border-teal bg-teal-soft/50" : "border-line",
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
                        className="mt-1 size-4.5 shrink-0 accent-teal"
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
              {copy.place.button}
            </Button>
            <p className="text-small text-muted">{copy.place.note}</p>
          </form>
        )}
      </OrderSummary>
    </div>
  );
}

const stateOptions = [
  { value: "", label: text.fields.chooseState },
  ...indianStates.map((state) => ({ value: state.code, label: state.name })),
];

function AddressForm({
  address,
  onSaved,
  onCancel,
}: {
  address: SavedAddress | null;
  onSaved: (id: number) => void;
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (previous: AddressFormState, formData: FormData) => {
      const result = await saveAddressAction(previous, formData);
      if (result.status === "success" && result.savedId) onSaved(result.savedId);
      return result;
    },
    idleForm,
  );
  const values = useFormValues(
    address
      ? { ...address }
      : {
          name: "",
          phone: "",
          line1: "",
          line2: "",
          landmark: "",
          city: "",
          state: "",
          pincode: "",
        },
    state,
  );
  const fields = text.fields;
  const titleId = address ? `address-form-${address.id}` : "address-form-new";

  return (
    <form
      action={formAction}
      noValidate
      aria-labelledby={titleId}
      className="rounded-lg border border-line bg-surface-alt p-4 sm:p-5"
    >
      <h3 id={titleId} className="text-base font-extrabold text-ink">
        {address ? text.formTitleEdit : text.formTitleNew}
      </h3>
      {address && <input type="hidden" name="id" value={address.id} />}
      {state.status === "error" && state.message && (
        <FormAlert className="mt-3">{state.message}</FormAlert>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField
          name="name"
          label={fields.name}
          values={values}
          autoComplete="name"
          maxLength={100}
          required
        />
        <PhoneInput
          name="phone"
          label={fields.phone}
          help={fields.phoneHelp}
          error={values.error("phone")}
          defaultValue={values.text("phone")}
          autoComplete="tel-national"
          required
        />
        <TextField
          name="line1"
          label={fields.line1}
          values={values}
          autoComplete="address-line1"
          maxLength={200}
          required
          className="sm:col-span-2"
        />
        <TextField
          name="line2"
          label={fields.line2}
          values={values}
          autoComplete="address-line2"
          maxLength={200}
          optional
          className="sm:col-span-2"
        />
        <TextField
          name="landmark"
          label={fields.landmark}
          values={values}
          maxLength={120}
          optional
        />
        <TextField
          name="city"
          label={fields.city}
          values={values}
          autoComplete="address-level2"
          maxLength={100}
          required
        />
        <SelectField
          name="state"
          label={fields.state}
          values={values}
          options={stateOptions}
          autoComplete="address-level1"
          required
        />
        <TextField
          name="pincode"
          label={fields.pincode}
          values={values}
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={6}
          required
        />
      </div>
      <div className="mt-5 flex flex-wrap gap-3 max-sm:*:w-full">
        <Button type="submit" variant="secondary" loading={pending}>
          {text.save}
        </Button>
        {onCancel && (
          <Button variant="link" onClick={onCancel}>
            {text.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}
