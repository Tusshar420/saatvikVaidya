"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import {
  adjustAction,
  createComponentAction,
  receiveAction,
  saveRecipeAction,
  settingsAction,
  writeOffAction,
} from "@/app/admin/inventory/actions";
import { CheckboxField, FormError, SelectField, TextField, useFormValues } from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { inventory as copy } from "@/content/inventory";
import { componentTypes, entryUnits, type StockUnitKey } from "@/lib/inventory";
import { idleForm, type FormState } from "@/server/admin/form";

// The Inventory screens' forms. Each is an uncontrolled form that shows what
// was submitted after a failed save, and clears itself after a good one.

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

function StatusLine({ state }: { state: FormState }) {
  return (
    <div role="status" aria-live="polite" className="empty:hidden">
      <FormError state={state} />
      {state.status === "success" && <p className="text-sm font-bold text-success">{state.message}</p>}
    </div>
  );
}

/** A form that resets after a successful save. */
function useResettingForm(action: Action, { reset = true } = {}) {
  const [state, run, pending] = useActionState(action, idleForm);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (reset && state.status === "success") ref.current?.reset();
  }, [state, reset]);
  return { state, run, pending, ref };
}

const unitOptions = (unit: StockUnitKey) => entryUnits[unit].map((entry) => ({ value: entry.key, label: entry.key }));

/** A quantity box with its unit (a choice for ml/L and g/kg, fixed for pieces). */
function QuantityFields({
  unit,
  values,
  label,
  name = "quantity",
  required = true,
}: {
  unit: StockUnitKey;
  values: ReturnType<typeof useFormValues>;
  label: ReactNode;
  name?: string;
  required?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-3">
      <TextField name={name} label={label} values={values} inputMode="decimal" maxLength={14} required={required} optional={!required} />
      {unit === "pcs" ? (
        <input type="hidden" name="entryUnit" value="pcs" />
      ) : (
        <SelectField name="entryUnit" label={copy.unitLabel} values={values} options={unitOptions(unit)} className="w-24" />
      )}
    </div>
  );
}

export function ReceiveForm({
  itemId,
  unit,
  finished,
  text = copy.item.receive,
}: {
  itemId: number;
  unit: StockUnitKey;
  finished: boolean;
  text?: { title: string; help: string; quantity: string; reason: string; submit: string };
}) {
  const { state, run, pending, ref } = useResettingForm(receiveAction);
  const values = useFormValues({ entryUnit: unit === "pcs" ? "pcs" : unit }, state);
  const batch = copy.item.receive;
  return (
    <form ref={ref} action={run} noValidate className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-card">
      <h3 className="text-h3 text-ink">{text.title}</h3>
      <p className="text-small text-muted">{text.help}</p>
      <input type="hidden" name="itemId" value={itemId} />
      <QuantityFields unit={unit} values={values} label={text.quantity} />
      {finished && (
        <>
          <TextField name="batchNo" label={batch.batchNo} help={batch.batchNoHelp} values={values} maxLength={60} optional />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField name="mfgDate" label={batch.mfgDate} values={values} type="date" optional />
            <TextField name="expiryDate" label={batch.expiryDate} values={values} type="date" optional />
          </div>
        </>
      )}
      <TextField name="unitCost" label={batch.unitCost} values={values} inputMode="decimal" maxLength={10} optional />
      <TextField name="reason" label={text.reason} values={values} maxLength={300} optional />
      <StatusLine state={state} />
      <Button type="submit" loading={pending} className="self-start max-sm:w-full">
        {text.submit}
      </Button>
    </form>
  );
}

export function AdjustForm({
  itemId,
  unit,
  batches,
  text = copy.item.adjust,
}: {
  itemId: number;
  unit: StockUnitKey;
  /** Finished items: the batches that can be corrected. */
  batches?: { id: number; label: string }[];
  text?: { title: string; help: string; submit: string };
}) {
  const { state, run, pending, ref } = useResettingForm(adjustAction);
  const values = useFormValues({ direction: "remove" }, state);
  const form = copy.item.adjust;
  return (
    <form ref={ref} action={run} noValidate className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-card">
      <h3 className="text-h3 text-ink">{text.title}</h3>
      <p className="text-small text-muted">{text.help}</p>
      <input type="hidden" name="itemId" value={itemId} />
      {batches && (
        <SelectField
          name="batchId"
          label={form.batch}
          values={values}
          options={[{ value: "", label: form.batchPlaceholder }, ...batches.map((batch) => ({ value: String(batch.id), label: batch.label }))]}
        />
      )}
      <SelectField
        name="direction"
        label={form.direction}
        values={values}
        options={[
          { value: "add", label: form.add },
          { value: "remove", label: form.remove },
        ]}
      />
      <QuantityFields unit={unit} values={values} label={form.quantity} />
      <TextField name="reason" label={form.reason} values={values} maxLength={300} required />
      <StatusLine state={state} />
      <Button type="submit" variant="secondary" loading={pending} className="self-start max-sm:w-full">
        {text.submit}
      </Button>
    </form>
  );
}

/** Low-stock level and cost for a finished item; full details for a component. */
export function SettingsForm({
  item,
}: {
  item: {
    id: number;
    unit: StockUnitKey;
    finished: boolean;
    baseKind: boolean;
    name: string;
    sku: string | null;
    componentType: string | null;
    notes: string | null;
    lowThreshold: number;
    purchaseCostPaise: number | null;
    madeToOrder: boolean;
    active: boolean;
  };
}) {
  const { state, run, pending } = useResettingForm(settingsAction, { reset: false });
  const component = copy.component.settings;
  const finished = copy.item.settings;
  const values = useFormValues(
    {
      name: item.name,
      sku: item.sku,
      componentType: item.componentType ?? "other",
      notes: item.notes,
      lowThreshold: item.unit === "pcs" || item.lowThreshold < 1000 ? item.lowThreshold : item.lowThreshold / 1000,
      entryUnit: item.unit === "pcs" || item.lowThreshold < 1000 ? item.unit : item.unit === "ml" ? "L" : "kg",
      purchaseCost: item.purchaseCostPaise === null ? null : (item.purchaseCostPaise / 100).toFixed(2),
      madeToOrder: item.madeToOrder,
      active: item.active ? "on" : "off",
    },
    state,
  );
  const title = item.finished ? finished.title : component.title;
  return (
    <form action={run} noValidate className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-card">
      <h3 className="text-h3 text-ink">{title}</h3>
      <input type="hidden" name="itemId" value={item.id} />
      {!item.finished && (
        <>
          <TextField name="name" label={component.name} values={values} maxLength={160} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField name="sku" label={component.sku} values={values} maxLength={60} optional />
            <SelectField
              name="componentType"
              label={component.type}
              values={values}
              options={componentTypes.map((type) => ({ value: type, label: copy.componentTypes[type] }))}
            />
          </div>
          <TextField name="notes" label={component.notes} values={values} maxLength={300} optional />
        </>
      )}
      <QuantityFields
        unit={item.unit}
        values={values}
        name="lowThreshold"
        label={item.finished ? finished.threshold : component.threshold}
        required={false}
      />
      <p className="-mt-2 text-small text-muted">{item.finished ? finished.thresholdHelp : component.thresholdHelp}</p>
      {item.finished && (
        <TextField name="purchaseCost" label={finished.cost} help={finished.costHelp} values={values} inputMode="decimal" maxLength={10} optional />
      )}
      {!item.finished && item.baseKind && <CheckboxField name="madeToOrder" label={component.madeToOrder} values={values} />}
      {!item.finished && (
        <SelectField
          name="active"
          label={component.inUse}
          values={values}
          options={[
            { value: "on", label: copy.common.yes },
            { value: "off", label: copy.common.no },
          ]}
        />
      )}
      <StatusLine state={state} />
      <Button type="submit" variant="secondary" loading={pending} className="self-start max-sm:w-full">
        {item.finished ? finished.submit : component.submit}
      </Button>
    </form>
  );
}

export function NewComponentForm() {
  const [state, run, pending] = useActionState(createComponentAction, idleForm);
  const values = useFormValues({ kind: "packaging", unit: "pcs", componentType: "bottle", entryUnit: "pcs" }, state);
  const text = copy.newComponent;
  return (
    <form action={run} noValidate className="flex max-w-2xl flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <p className="text-small text-muted">{text.help}</p>
      <SelectField
        name="kind"
        label={text.kind}
        values={values}
        options={[
          { value: "packaging", label: text.kindPackaging },
          { value: "base", label: text.kindBase },
        ]}
      />
      <TextField name="name" label={text.name} placeholder={text.namePlaceholder} values={values} maxLength={160} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="sku" label={text.sku} values={values} maxLength={60} optional />
        <SelectField
          name="componentType"
          label={text.type}
          values={values}
          options={componentTypes.map((type) => ({ value: type, label: copy.componentTypes[type] }))}
        />
      </div>
      <SelectField
        name="unit"
        label={text.unit}
        values={values}
        options={[
          { value: "pcs", label: copy.units.pcs },
          { value: "ml", label: copy.units.ml },
          { value: "g", label: copy.units.g },
        ]}
      />
      <TextField name="lowThreshold" label={text.threshold} help={text.thresholdHelp} values={values} inputMode="decimal" maxLength={14} optional />
      <CheckboxField name="madeToOrder" label={text.madeToOrder} values={values} />
      <StatusLine state={state} />
      <Button type="submit" loading={pending} className="self-start max-sm:w-full">
        {text.submit}
      </Button>
    </form>
  );
}

export function WriteOffButton({ batchId, label }: { batchId: number; label: string }) {
  const [state, run, pending] = useActionState(writeOffAction, idleForm);
  return (
    <form action={run} className="flex flex-col gap-1">
      <input type="hidden" name="batchId" value={batchId} />
      <Button type="submit" variant="secondary" size="sm" loading={pending} aria-label={label}>
        {copy.item.batches.writeOff}
      </Button>
      <div role="status" aria-live="polite" className="empty:hidden">
        {state.status === "error" && <p className="text-small font-medium text-danger">{state.message}</p>}
        {state.status === "success" && <p className="text-small font-bold text-success">{state.message}</p>}
      </div>
    </form>
  );
}

export type RecipeFormLine = { componentId: number; name: string; unit: StockUnitKey; quantity: number };

export function RecipeForm({
  productId,
  lines,
  components,
}: {
  productId: number;
  lines: RecipeFormLine[];
  components: { id: number; name: string; unit: StockUnitKey }[];
}) {
  const { state, run, pending, ref } = useResettingForm(saveRecipeAction.bind(null, productId));
  const initial = Object.fromEntries(lines.map((line) => [`qty-${line.componentId}`, line.quantity]));
  const values = useFormValues({ ...initial, newComponent: "" }, state);
  const text = copy.recipe;
  const used = new Set(lines.map((line) => line.componentId));
  return (
    <form ref={ref} action={run} noValidate className="flex flex-col gap-5">
      {lines.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-5 text-sm text-muted shadow-card">{text.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-card">
          {lines.map((line) => (
            <li key={line.componentId} className="grid items-start gap-3 p-4 sm:grid-cols-[1fr_12rem_auto]">
              <p className="font-bold text-ink sm:pt-3">{line.name}</p>
              <TextField
                name={`qty-${line.componentId}`}
                label={`${text.columns.quantity} (${line.unit})`}
                values={values}
                inputMode="numeric"
                maxLength={7}
                required
              />
              <div className="sm:pt-8">
                <CheckboxField name={`remove-${line.componentId}`} label={text.remove(line.name)} values={values} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <fieldset className="grid gap-3 rounded-xl border border-line bg-surface p-5 shadow-card sm:grid-cols-[1fr_12rem]">
        <legend className="float-left mb-3 w-full text-h3 text-ink">{text.add}</legend>
        <SelectField
          name="newComponent"
          label={text.columns.component}
          values={values}
          options={[
            { value: "", label: text.addPlaceholder },
            ...components.filter((component) => !used.has(component.id)).map((component) => ({ value: String(component.id), label: `${component.name} (${component.unit})` })),
          ]}
        />
        <TextField name="newQuantity" label={text.addQuantity} values={values} inputMode="numeric" maxLength={7} />
      </fieldset>
      <StatusLine state={state} />
      <Button type="submit" loading={pending} className="self-start max-sm:w-full">
        {text.submit}
      </Button>
    </form>
  );
}
