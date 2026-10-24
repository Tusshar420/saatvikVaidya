"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { savePackagingAction } from "@/app/(site)/launch/actions";
import { TextAreaField, useFormValues } from "@/components/admin/form-fields";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { brand as copy } from "@/content/brand";
import { cn } from "@/lib/cn";
import {
  labelProblems,
  labelRoom,
  labelFields,
  multilineLabelFields,
  specFields,
  type LabelField,
  type LabelSpecData,
  type LabelValues,
} from "@/lib/label";
import { idleForm } from "@/server/admin/form";

const text = copy.labels;

export type LabelLineView = {
  productId: number;
  name: string;
  spec: LabelSpecData;
  /** The label as it starts: the brand fitted to the pack. */
  defaults: LabelValues;
  /** Fields whose brand text was shortened to fit. */
  trimmed: LabelField[];
  /** The label as it stands now (the brand plus this product's changes). */
  values: LabelValues;
};

/**
 * Step 3's label details: for each product in the launch cart, the fields
 * its pack can print, starting from the chosen brand and fitted to that
 * pack. Each field can be changed for that product alone (the saved brand
 * isn't touched), with a live count and a clear warning when the text is
 * too long for the pack.
 */
export function LabelDetailsForm({ lines, notes }: { lines: LabelLineView[]; notes: string | null }) {
  const [state, action, pending] = useActionState(savePackagingAction, idleForm);
  const [typed, setTyped] = useState<Record<number, LabelValues>>(() =>
    Object.fromEntries(lines.map((line) => [line.productId, line.values])),
  );
  const noteValues = useFormValues({ notes }, state);

  /* eslint-disable @typescript-eslint/no-unused-vars -- used again when the per-product labels return */
  const overCount = lines.filter(
    (line) => labelProblems(typed[line.productId] ?? line.values, line.spec).length > 0,
  ).length;

  function change(productId: number, field: LabelField, value: string) {
    setTyped((all) => ({ ...all, [productId]: { ...all[productId], [field]: value } }));
  }

  /* eslint-enable @typescript-eslint/no-unused-vars */

  return (
    <form action={action} noValidate aria-label={copy.packaging.title} className="flex flex-col gap-5">
      {state.status === "error" && state.message && <FormAlert>{state.message}</FormAlert>}
      {/* "Label for each product" is switched off for now: the client only needs the brand details.
      <div>
        <h3 id="label-details-title" className="text-h3 text-ink">
          {text.title}
        </h3>
        <p className="mt-1.5 max-w-2xl text-body text-muted">{text.line}</p>
      </div>
      {overCount > 0 && (
        <p role="status" className="text-sm font-bold text-danger">
          {text.summaryOver(overCount)}
        </p>
      )}
      <ul aria-label={text.title} className="flex flex-col gap-3">
        {lines.map((line) => (
          <LabelLine
            key={line.productId}
            line={line}
            values={typed[line.productId] ?? line.values}
            open={lines.length <= 3}
            onChange={(field, value) => change(line.productId, field, value)}
            serverErrors={state.fieldErrors}
          />
        ))}
      </ul>
      */}
      <TextAreaField
        name="notes"
        label={copy.packaging.notes}
        help={copy.packaging.notesHelp}
        values={noteValues}
        maxLength={1000}
        rows={3}
        optional
        className="max-w-2xl"
      />
      <div className="flex flex-wrap items-center gap-3 max-sm:flex-col-reverse max-sm:*:w-full">
        <Link href="/launch?step=2" className={buttonClasses({ variant: "secondary" })}>
          {copy.launch.back}
        </Link>
        <Button type="submit" loading={pending} arrow>
          {copy.launch.continue}
        </Button>
      </div>
    </form>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for when the per-product labels return
function LabelLine({
  line,
  values,
  open,
  onChange,
  serverErrors,
}: {
  line: LabelLineView;
  values: LabelValues;
  open: boolean;
  onChange: (field: LabelField, value: string) => void;
  serverErrors?: Record<string, string>;
}) {
  const { spec } = line;
  const details = useRef<HTMLDetailsElement>(null);
  // Open from the start only for a few products or one with a problem; after
  // that the customer decides (a flipping `open` would close it while typing).
  const [startsOpen] = useState(() => open || labelProblems(values, line.spec).length > 0);
  const hasServerError = Object.keys(serverErrors ?? {}).some((name) => name.startsWith(`label-${line.productId}-`));
  useEffect(() => {
    // A save that found a problem here shows it.
    if (hasServerError && details.current) details.current.open = true;
  }, [hasServerError, serverErrors]);
  const shown = specFields(spec);
  const problems = labelProblems(values, spec);
  const edited = shown.filter((field) => (values[field] ?? "") !== (line.defaults[field] ?? ""));
  const notPrinted = labelFields
    .filter((field) => !shown.includes(field))
    .map((field) => text.fields[field].toLowerCase());
  const descriptionNote =
    spec.limits.description !== undefined
      ? spec.descriptionSource === "short"
        ? text.descriptionShort
        : text.descriptionLong
      : null;

  return (
    <li className="rounded-lg border border-line bg-surface">
      <details ref={details} open={startsOpen}>
        <summary className="flex min-h-14 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-4">
          <span className="min-w-0 flex-1 text-base font-extrabold break-words text-ink">{line.name}</span>
          {problems.length > 0 && <Badge variant="live">{text.overBadge}</Badge>}
          {edited.length > 0 && <Badge variant="gold">{text.changedBadge}</Badge>}
        </summary>
        <div className="flex flex-col gap-4 border-t border-line p-4">
          <div className="text-small text-muted">
            <p className="font-bold text-ink">
              {text.area(spec.name, spec.widthMm, spec.heightMm)}
            </p>
            <p>
              {text.logo(spec.logo.widthMm, spec.logo.heightMm, text.placements[spec.logo.placement])}
            </p>
            {descriptionNote && <p>{descriptionNote}</p>}
            {notPrinted.length > 0 && <p>{text.notPrinted(notPrinted.join(", "))}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {shown.map((field) => (
              <LabelInput
                key={field}
                line={line}
                field={field}
                value={values[field] ?? ""}
                onChange={(value) => onChange(field, value)}
                serverError={serverErrors?.[`label-${line.productId}-${field}`]}
              />
            ))}
          </div>
        </div>
      </details>
    </li>
  );
}

function LabelInput({
  line,
  field,
  value,
  onChange,
  serverError,
}: {
  line: LabelLineView;
  field: LabelField;
  value: string;
  onChange: (value: string) => void;
  serverError?: string;
}) {
  const id = useId();
  const limit = line.spec.limits[field] ?? 0;
  const room = labelRoom(value, limit);
  const blank = field === "brandName" && value.trim().length === 0;
  const over = room < 0;
  const changed = value !== (line.defaults[field] ?? "");
  const shortened = line.trimmed.includes(field) && !changed;
  const label = text.fields[field];
  const multiline = multilineLabelFields.includes(field);
  const wide = multiline && field !== "marketedByAddress" && field !== "licenceNumbers";
  const problem = blank ? text.blankBrand : over ? text.over(-room, limit) : null;
  const fieldClass = cn(inputClasses, "h-auto py-3 leading-normal", multiline ? "min-h-24" : "h-12 py-0");
  return (
    <div className={cn("flex min-w-0 flex-col", wide && "sm:col-span-2")}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-extrabold text-ink">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={`label-${line.productId}-${field}`}
          value={value}
          rows={wide ? 4 : 3}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={problem || serverError ? true : undefined}
          aria-describedby={`${id}-note`}
          className={fieldClass}
        />
      ) : (
        <input
          id={id}
          name={`label-${line.productId}-${field}`}
          type={field === "contactPhone" ? "tel" : "text"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={problem || serverError ? true : undefined}
          aria-describedby={`${id}-note`}
          className={fieldClass}
        />
      )}
      <div id={`${id}-note`} className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p
          className={cn("text-small", problem ? "font-bold text-danger" : "text-muted")}
          role={problem ? "alert" : undefined}
        >
          {problem ?? text.left(room, limit)}
        </p>
        {changed ? (
          <Button
            variant="link"
            size="sm"
            aria-label={text.resetLabel(label, line.name)}
            onClick={() => onChange(line.defaults[field] ?? "")}
          >
            {text.reset}
          </Button>
        ) : shortened ? (
          <p className="text-small text-muted">{text.shortened}</p>
        ) : null}
      </div>
    </div>
  );
}
