"use client";

import { startTransition, useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, inputClasses, useFieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { admin as copy } from "@/content/admin";
import { brand as brandCopy } from "@/content/brand";
import {
  MAX_BRAND_VARIANTS,
  MAX_VARIANT_NAME,
  brandThemes,
  type BrandThemeKey,
  type BrandVariant,
} from "@/lib/brand-theme";
import { cn } from "@/lib/cn";
import { idleForm, type FormState } from "@/server/admin/form";

const text = copy.catalogue.variants;
const themeNames = brandCopy.customise.themes;

/** A row being edited; `id` only tells React rows apart (new rows have no key yet). */
type Row = { id: number; key: string; name: string; style: BrandThemeKey };

const toRows = (variants: BrandVariant[]): Row[] =>
  variants.map((variant, index) => ({ id: index, ...variant }));

const signature = (variants: BrandVariant[]) =>
  variants.map((variant) => `${variant.key}:${variant.name}:${variant.style}`).join("|");

/**
 * A Build Your Brand product's label variants: rename them, pick each one's
 * pack colour (the drawn pack when it has no photo), add and remove them
 * (1 to MAX_BRAND_VARIANTS), then save the whole list at once.
 */
export function ProductVariants({
  variants,
  action,
}: {
  variants: BrandVariant[];
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const [rows, setRows] = useState<Row[]>(() => toRows(variants));
  const [nextId, setNextId] = useState(variants.length);
  // After a save the page brings the saved list (new variants now have their
  // key): start from it again, keeping the "saved" message.
  const saved = signature(variants);
  const [shown, setShown] = useState(saved);
  if (saved !== shown) {
    setShown(saved);
    setRows(toRows(variants));
    setNextId(variants.length);
  }

  function add() {
    // A new variant takes the next pack colour in turn.
    const style = brandThemes[rows.length % brandThemes.length]?.key ?? "classic-green";
    setRows([...rows, { id: nextId, key: "", name: "", style }]);
    setNextId(nextId + 1);
  }

  function change(id: number, patch: Partial<Row>) {
    setRows(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  return (
    <form
      // Submitted by hand: a form `action` resets the fields after saving,
      // which puts these controlled selects out of step with their state.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      aria-labelledby="variants-title"
      className="mt-4 rounded-lg border border-line p-4"
    >
      <h3 id="variants-title" className="text-base font-extrabold text-ink">
        {text.title}
      </h3>
      <p className="mt-1 text-small text-muted">{text.description(MAX_BRAND_VARIANTS)}</p>
      {state.fieldErrors?.variants && (
        <p role="alert" className="mt-2 text-small font-semibold text-danger">
          {state.fieldErrors.variants}
        </p>
      )}
      <ol className="mt-3 flex flex-col gap-3">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className="grid gap-3 rounded-md border border-line bg-surface-alt/50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto] sm:items-end"
          >
            <input type="hidden" name="variantKey" value={row.key} />
            <Input
              name="variantName"
              label={text.name(index + 1)}
              value={row.name}
              onChange={(event) => change(row.id, { name: event.target.value })}
              maxLength={MAX_VARIANT_NAME}
              error={state.fieldErrors?.[`variantName-${index}`]}
            />
            <StyleSelect
              label={text.style(index + 1)}
              value={row.style}
              onChange={(style) => change(row.id, { style })}
              error={state.fieldErrors?.[`variantStyle-${index}`]}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={rows.length <= 1}
              onClick={() => setRows(rows.filter((other) => other.id !== row.id))}
              aria-label={text.remove(index + 1)}
              icon={<Trash2 aria-hidden className="size-4" />}
              className="sm:mb-1"
            />
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {rows.length < MAX_BRAND_VARIANTS && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={add}
            icon={<Plus aria-hidden className="size-4" />}
          >
            {text.add}
          </Button>
        )}
        <Button type="submit" size="sm" loading={pending}>
          {text.save}
        </Button>
        {state.status === "success" && (
          <p role="status" className="text-small font-semibold text-success">
            {state.message}
          </p>
        )}
        {state.status === "error" && state.message && (
          <p role="alert" className="text-small font-semibold text-danger">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

function StyleSelect({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: BrandThemeKey;
  onChange: (style: BrandThemeKey) => void;
  error?: string;
}) {
  const ids = useFieldIds(undefined, { error });
  return (
    <Field ids={ids} label={label} error={error} className="min-w-0">
      <select
        id={ids.inputId}
        name="variantStyle"
        value={value}
        onChange={(event) => {
          const style = brandThemes.find((theme) => theme.key === event.target.value)?.key;
          if (style) onChange(style);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(inputClasses, "cursor-pointer")}
      >
        {brandThemes.map((theme) => (
          <option key={theme.key} value={theme.key}>
            {themeNames[theme.key]}
          </option>
        ))}
      </select>
    </Field>
  );
}
