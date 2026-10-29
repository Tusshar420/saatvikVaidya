"use client";

import { Input } from "@/components/ui/input";
import { admin as copy } from "@/content/admin";
import {
  CheckboxField,
  TextField,
  useFormValues,
  type SelectOption,
} from "./form-fields";

type Values = ReturnType<typeof useFormValues>;

export const toneOptions: SelectOption[] = (
  ["ORANGE", "TEAL", "BLUE", "GOLD", "NAVY", "GREEN"] as const
).map((tone) => ({ value: tone, label: copy.tones[tone] }));

/** Editable when creating; shown read-only (and not submitted) when editing. */
export function KeyField({
  mode,
  values,
}: {
  mode: "new" | "edit";
  values: Values;
}) {
  if (mode === "edit") {
    return (
      <Input
        label={copy.common.key}
        help={copy.common.keyLocked}
        defaultValue={values.text("key")}
        readOnly
        wrapperClassName="sm:col-span-2"
        className="font-mono"
      />
    );
  }
  return (
    <TextField
      name="key"
      label={copy.common.key}
      help={copy.common.keyHelp}
      values={values}
      maxLength={64}
      autoCapitalize="none"
      autoComplete="off"
      spellCheck={false}
      required
      className="sm:col-span-2"
    />
  );
}

/** Sort order and the "show on the site" switch. */
export function PlacementFields({ values }: { values: Values }) {
  return (
    <>
      <TextField
        name="sortOrder"
        type="number"
        inputMode="numeric"
        label={copy.common.sortOrder}
        help={copy.common.sortOrderHelp}
        values={values}
        step={1}
      />
      <CheckboxField
        name="active"
        label={copy.common.activeToggle}
        values={values}
        className="self-end"
      />
    </>
  );
}
