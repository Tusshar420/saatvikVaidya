"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { deleteAddressAction, saveAccountAddressAction } from "@/app/(site)/account/actions";
import { AddressForm } from "@/components/site/address-form";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { account as copy } from "@/content/account";
import { addressLines, addressPhone } from "@/lib/address";
import { idleForm } from "@/server/admin/form";
import type { SavedAddress } from "@/server/checkout/addresses";

const text = copy.addresses;

/** The saved addresses with add, edit and delete. */
export function AddressBook({ addresses, max }: { addresses: SavedAddress[]; max: number }) {
  const [editing, setEditing] = useState<"new" | number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div>
      {notice && (
        <FormAlert tone="success" className="mb-4">
          {notice}
        </FormAlert>
      )}
      {addresses.length === 0 && editing !== "new" && <p className="text-body text-muted">{text.empty}</p>}
      <ul className="flex flex-col gap-3">
        {addresses.map((address) =>
          editing === address.id ? (
            <li key={address.id}>
              <AddressForm
                address={address}
                action={saveAccountAddressAction}
                onSaved={() => {
                  setNotice(text.saved);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <AddressItem
              key={address.id}
              address={address}
              onEdit={() => {
                setNotice(null);
                setEditing(address.id);
              }}
              onRemoved={(message) => setNotice(message)}
            />
          ),
        )}
      </ul>
      <div className="mt-5">
        {editing === "new" ? (
          <AddressForm
            address={null}
            action={saveAccountAddressAction}
            onSaved={() => {
              setNotice(text.saved);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          addresses.length < max && (
            <Button
              variant="secondary"
              icon={<Plus aria-hidden className="size-4" />}
              onClick={() => {
                setNotice(null);
                setEditing("new");
              }}
              className="max-sm:w-full"
            >
              {text.add}
            </Button>
          )
        )}
      </div>
      <p className="mt-4 text-small text-muted">{text.count(addresses.length, max)}</p>
    </div>
  );
}

function AddressItem({
  address,
  onEdit,
  onRemoved,
}: {
  address: SavedAddress;
  onEdit: () => void;
  onRemoved: (message: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(
    async (previous: typeof idleForm, formData: FormData) => {
      const result = await deleteAddressAction(previous, formData);
      if (result.message) onRemoved(result.message);
      return result;
    },
    idleForm,
  );
  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <p className="text-sm font-extrabold text-ink">{address.name}</p>
      <div className="mt-1 text-sm text-ink">
        {addressLines(address).map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </div>
      <p className="mt-1 text-small text-muted">{addressPhone(address)}</p>
      {state.status === "error" && state.message && <FormAlert className="mt-3">{state.message}</FormAlert>}
      {confirming ? (
        <form action={action} role="group" aria-label={text.removeTitle} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={address.id} />
          <span className="text-sm font-bold text-ink">{text.removeTitle}</span>
          <Button type="submit" size="sm" loading={pending}>
            {text.removeConfirm}
          </Button>
          <Button variant="link" size="sm" onClick={() => setConfirming(false)}>
            {text.cancel}
          </Button>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" aria-label={text.editLabel(address.name)} onClick={onEdit}>
            {text.edit}
          </Button>
          <Button variant="link" size="sm" aria-label={text.removeLabel(address.name)} onClick={() => setConfirming(true)}>
            {text.remove}
          </Button>
        </div>
      )}
    </li>
  );
}
