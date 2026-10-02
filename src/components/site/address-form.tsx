"use client";

import { useActionState } from "react";
import { SelectField, TextField, useFormValues } from "@/components/admin/form-fields";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { checkout as copy } from "@/content/checkout";
import { indianStates } from "@/lib/india";
import { idleForm } from "@/server/admin/form";
import type { AddressFormState, SavedAddress } from "@/server/checkout/addresses";

const text = copy.address;

const stateOptions = [
  { value: "", label: text.fields.chooseState },
  ...indianStates.map((state) => ({ value: state.code, label: state.name })),
];

/** Add or edit a delivery address; `action` is the server action that saves it. */
export function AddressForm({
  address,
  action,
  onSaved,
  onCancel,
}: {
  address: SavedAddress | null;
  action: (previous: AddressFormState, formData: FormData) => Promise<AddressFormState>;
  onSaved: (id: number) => void;
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (previous: AddressFormState, formData: FormData) => {
      const result = await action(previous, formData);
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
