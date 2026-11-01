"use client";

import { useActionState, useState } from "react";
import { Ban, Check, Copy, MessageCircle, Plus, Send } from "lucide-react";
import {
  cancelAssistedAction,
  placeByStaffAction,
  resendLinkAction,
  sendCodeAction,
} from "@/app/admin/assisted-orders/actions";
import { AddressForm } from "@/components/site/address-form";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { assistedOrders as copy } from "@/content/assisted-orders";
import { checkout as checkoutCopy } from "@/content/checkout";
import { addressLines, addressPhone } from "@/lib/address";
import { cn } from "@/lib/cn";
import { idleForm, type FormState } from "@/server/admin/form";
import type { AddressFormState, SavedAddress } from "@/server/checkout/addresses";

// The working parts of an order prepared for a customer
// (/admin/assisted-orders/[id]): share or resend the link, confirm the order
// on a call with the customer's code, and cancel it.

const text = copy.admin.detail;

function Result({ state }: { state: FormState }) {
  if (!state.message) return null;
  return <FormAlert tone={state.status === "error" ? "error" : "success"}>{state.message}</FormAlert>;
}

/** Option 1: the link to copy, share on WhatsApp or send again. */
export function LinkPanel({
  id,
  link,
  customerName,
  phoneNumber,
}: {
  id: string;
  link: string;
  customerName: string;
  /** "+91XXXXXXXXXX", for the WhatsApp chat. */
  phoneNumber: string | null;
}) {
  const [state, action, pending] = useActionState(resendLinkAction, idleForm);
  const [copied, setCopied] = useState(false);
  const message = text.whatsappText(customerName, link);
  // wa.me opens a chat with the customer (or a contact picker without a number).
  const whatsapp = `https://wa.me/${phoneNumber ? phoneNumber.replace(/\D/g, "") : ""}?text=${encodeURIComponent(message)}`;

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="assisted-link" className="text-xs font-extrabold text-ink">
        {text.linkLabel}
      </label>
      <input
        id="assisted-link"
        readOnly
        value={link}
        onFocus={(event) => event.currentTarget.select()}
        className={cn(inputClasses, "font-mono text-small")}
      />
      <div className="flex flex-wrap gap-2 max-sm:*:w-full">
        <Button
          variant="secondary"
          size="sm"
          icon={copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            } catch {
              // No clipboard access (e.g. not https): the field is still there to copy by hand.
              document.getElementById("assisted-link")?.focus();
            }
          }}
        >
          {copied ? text.copied : text.copy}
        </Button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          <MessageCircle aria-hidden className="size-4" />
          {text.whatsapp}
        </a>
        <form action={action} className="max-sm:w-full">
          <input type="hidden" name="id" value={id} />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={pending}
            icon={<Send aria-hidden className="size-4" />}
            className="max-sm:w-full"
          >
            {text.resend}
          </Button>
        </form>
      </div>
      <span role="status" className="sr-only">
        {copied ? text.copied : ""}
      </span>
      <Result state={state} />
    </div>
  );
}

/**
 * Option 2: on a call. Pick (or add) the delivery address with the
 * customer, send them a code, and place the order once they read it back.
 */
export function PhonePanel({
  id,
  addresses,
  expectedTotalPaise,
  codeLive,
  canPlace,
  canReach,
  saveAddress,
}: {
  id: string;
  addresses: SavedAddress[];
  /** The total shown on the page; a different total at placing means something changed. */
  expectedTotalPaise: number;
  /** A code was sent and still works. */
  codeLive: boolean;
  /** Every item can be bought as it is. */
  canPlace: boolean;
  /** The customer has a mobile or an email to send the code to. */
  canReach: boolean;
  saveAddress: (state: AddressFormState, formData: FormData) => Promise<AddressFormState>;
}) {
  const [selected, setSelected] = useState<number | null>(addresses[0]?.id ?? null);
  const [adding, setAdding] = useState(addresses.length === 0);
  const [codeState, codeAction, sending] = useActionState(sendCodeAction, idleForm);
  const [placeState, placeAction, placing] = useActionState(placeByStaffAction, idleForm);
  const chosen = addresses.some((address) => address.id === selected) ? selected : null;
  const codeSent = codeLive || codeState.status === "success";

  if (!canReach) return <p className="text-sm text-muted">{text.codeNowhere}</p>;

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-2 text-xs font-extrabold text-ink">{text.addressLabel}</legend>
        {addresses.length === 0 ? (
          <p className="text-sm text-muted">{text.noAddress}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {addresses.map((address) => {
              const active = chosen === address.id;
              return (
                <li
                  key={address.id}
                  className={cn("rounded-lg border transition", active ? "border-brand bg-brand-soft/50" : "border-line")}
                >
                  <label className="flex cursor-pointer items-start gap-3 p-3 text-sm">
                    <input
                      type="radio"
                      name="assisted-address"
                      value={address.id}
                      checked={active}
                      onChange={() => setSelected(address.id)}
                      className="mt-1 size-4.5 shrink-0 accent-brand"
                    />
                    <span className="min-w-0">
                      <span className="block font-extrabold text-ink">{address.name}</span>
                      {addressLines(address).map((line) => (
                        <span key={line} className="block text-ink">
                          {line}
                        </span>
                      ))}
                      <span className="mt-1 block text-small text-muted">
                        {checkoutCopy.address.phoneLine(addressPhone(address))}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3">
          {adding ? (
            <AddressForm
              address={null}
              action={saveAddress}
              onSaved={(savedId) => {
                setSelected(savedId);
                setAdding(false);
              }}
              onCancel={addresses.length > 0 ? () => setAdding(false) : undefined}
            />
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus aria-hidden className="size-4" />}
              onClick={() => setAdding(true)}
              className="max-sm:w-full"
            >
              {text.addAddress}
            </Button>
          )}
        </div>
      </fieldset>

      <form action={codeAction} className="flex flex-col gap-3 border-t border-line pt-4">
        <input type="hidden" name="id" value={id} />
        <Button
          type="submit"
          variant={codeSent ? "secondary" : "dark"}
          loading={sending}
          disabled={!canPlace}
          icon={<Send aria-hidden className="size-4" />}
          className="self-start max-sm:w-full"
        >
          {codeSent ? text.sendCodeAgain : text.sendCode}
        </Button>
        <Result state={codeState} />
      </form>

      {codeSent && (
        <form action={placeAction} className="flex flex-col gap-3 border-t border-line pt-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="addressId" value={chosen ?? ""} />
          <input type="hidden" name="expectedTotalPaise" value={expectedTotalPaise} />
          <Input
            key={placeState.status === "error" ? placeState.message : "code"}
            name="code"
            label={text.codeLabel}
            help={text.codeHelp}
            error={placeState.fieldErrors?.code}
            inputMode="numeric"
            autoComplete="off"
            pattern="\d{6}"
            maxLength={6}
            required
            wrapperClassName="sm:max-w-56"
            className="font-mono tracking-[0.3em]"
          />
          {placeState.status === "error" && !placeState.fieldErrors?.code && <Result state={placeState} />}
          <Button
            type="submit"
            loading={placing}
            disabled={chosen === null || !canPlace}
            arrow
            className="self-start max-sm:w-full"
          >
            {text.place}
          </Button>
          <p className="text-small text-muted">{text.placeNote}</p>
        </form>
      )}
    </div>
  );
}

/** Withdraw the prepared order. */
export function CancelPanel({ id }: { id: string }) {
  const [state, action, pending] = useActionState(cancelAssistedAction, idleForm);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-muted">{text.cancelLine}</p>
      <Button
        type="submit"
        variant="secondary"
        loading={pending}
        icon={<Ban aria-hidden className="size-4" />}
        className="self-start max-sm:w-full"
      >
        {text.cancel}
      </Button>
      <Result state={state} />
    </form>
  );
}
