"use client";

import { useActionState } from "react";
import { admin as copy } from "@/content/admin";
import { brand as brandCopy } from "@/content/brand";
import { MAX_BRAND_TIERS } from "@/lib/brand";
import { MAX_BULK_TIERS, gstRates } from "@/lib/catalogue";
import { idleForm, type FormState } from "@/server/admin/form";
import {
  CheckboxField,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  TextAreaField,
  TextField,
  useFormValues,
  type FieldValues,
} from "./form-fields";

const text = copy.catalogue;
const brandText = brandCopy.catalogue;
const form = text.form;

type Option = { id: number; name: string; active: boolean };

export type ProductFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: FieldValues;
  mode: "new" | "edit";
  options: { brands: Option[]; forms: Option[]; areas: Option[]; labelSpecs: { id: number; name: string }[] };
};

/** A choice list; hidden brands and forms are marked so they're not picked by mistake. */
const choices = (placeholder: string, items: Option[]) => [
  { value: "", label: placeholder },
  ...items.map((item) => ({
    value: String(item.id),
    label: item.active ? item.name : `${item.name} (${copy.common.hidden})`,
  })),
];

export function ProductForm({ action, initial, mode, options }: ProductFormProps) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const values = useFormValues(initial, state);
  const areasError = values.error("practiceAreaIds");

  return (
    <form action={formAction} noValidate className="mt-6 flex flex-col gap-5">
      <FormError state={state} />

      <FormSection title={form.sections.basics}>
        <TextField name="name" label={form.name} values={values} maxLength={160} required />
        <TextField
          name="slug"
          label={form.slug}
          help={form.slugHelp}
          values={values}
          maxLength={120}
          optional
          autoCapitalize="none"
          spellCheck={false}
        />
        <SelectField
          name="brandId"
          label={form.brand}
          values={values}
          options={choices(form.chooseBrand, options.brands)}
          required
        />
        <SelectField
          name="formId"
          label={form.productForm}
          values={values}
          options={choices(form.chooseForm, options.forms)}
          required
        />
        <TextField
          name="packSize"
          label={form.packSize}
          help={form.packSizeHelp}
          values={values}
          maxLength={60}
          required
        />
        <fieldset className="sm:col-span-2" aria-describedby="practice-areas-help">
          <legend className="text-xs font-extrabold text-ink">{form.practiceAreas}</legend>
          <p id="practice-areas-help" className="mt-1 text-small text-muted">
            {form.practiceAreasHelp}
          </p>
          {options.areas.length === 0 ? (
            <p className="mt-2 text-small text-muted">{form.noPracticeAreas}</p>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {options.areas.map((area) => (
                <CheckboxField
                  key={area.id}
                  name={`area-${area.id}`}
                  label={area.active ? area.name : `${area.name} (${copy.common.hidden})`}
                  values={values}
                />
              ))}
            </div>
          )}
          {areasError && (
            <p className="mt-1.5 text-small font-medium text-danger">{areasError}</p>
          )}
        </fieldset>
      </FormSection>

      <FormSection title={form.sections.text}>
        <TextAreaField
          name="description"
          label={form.description}
          help={form.descriptionHelp}
          values={values}
          maxLength={5000}
          rows={5}
          required
          className="sm:col-span-2"
        />
        <TextAreaField
          name="ingredients"
          label={form.ingredients}
          values={values}
          maxLength={5000}
          optional
          className="sm:col-span-2"
        />
        <TextAreaField
          name="dosage"
          label={form.dosage}
          values={values}
          maxLength={5000}
          optional
          className="sm:col-span-2"
        />
      </FormSection>

      <FormSection title={form.sections.pricing}>
        <TextField
          name="mrp"
          label={form.mrp}
          help={form.mrpHelp}
          values={values}
          inputMode="decimal"
          maxLength={14}
          required
        />
        <TextField
          name="professionalPrice"
          label={form.professionalPrice}
          help={form.professionalPriceHelp}
          values={values}
          inputMode="decimal"
          maxLength={14}
          required
        />
        <SelectField
          name="gstRate"
          label={form.gstRate}
          values={values}
          options={gstRates.map((rate) => ({
            value: String(rate),
            label: form.gstOption(rate),
          }))}
        />
        <TextField
          name="hsnCode"
          label={form.hsnCode}
          help={form.hsnCodeHelp}
          values={values}
          inputMode="numeric"
          maxLength={8}
          required
        />
      </FormSection>

      <FormSection title={form.sections.bulk}>
        <p className="text-small text-muted sm:col-span-2">{form.bulkHelp}</p>
        {Array.from({ length: MAX_BULK_TIERS }, (_, index) => (
          <div
            key={index}
            className="grid gap-3 border-t border-line pt-4 sm:col-span-2 sm:grid-cols-2 sm:gap-5"
          >
            <TextField
              name={`tiers.${index}.minQuantity`}
              label={form.tierMin(index + 1)}
              values={values}
              inputMode="numeric"
              maxLength={7}
              optional
            />
            <TextField
              name={`tiers.${index}.price`}
              label={form.tierPrice(index + 1)}
              values={values}
              inputMode="decimal"
              maxLength={14}
              optional
            />
          </div>
        ))}
      </FormSection>

      <FormSection title={form.sections.stock}>
        <TextField
          name="stock"
          label={form.stock}
          values={values}
          inputMode="numeric"
          maxLength={7}
          required
        />
        <TextField
          name="moq"
          label={form.moq}
          help={form.moqHelp}
          values={values}
          inputMode="numeric"
          maxLength={5}
          required
        />
      </FormSection>

      <FormSection title={brandText.section}>
        <p className="text-small text-muted sm:col-span-2">{brandText.help}</p>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <CheckboxField name="brandEligible" label={brandText.eligible} values={values} />
          {values.error("brandEligible") && (
            <p className="text-small font-medium text-danger">{values.error("brandEligible")}</p>
          )}
        </div>
        <TextField
          name="brandMinQty"
          label={brandText.minQty}
          values={values}
          inputMode="numeric"
          maxLength={5}
          optional
        />
        <TextField
          name="brandUnitPrice"
          label={brandText.unitPrice}
          help={brandText.unitPriceHelp}
          values={values}
          inputMode="decimal"
          maxLength={14}
          optional
        />
        <TextField
          name="brandUnitLabel"
          label={brandText.unitLabel}
          help={brandText.unitLabelHelp}
          values={values}
          maxLength={30}
          optional
        />
        <SelectField
          name="labelSpecId"
          label={brandText.labelSpec}
          help={brandText.labelSpecHelp}
          values={values}
          options={[
            { value: "", label: brandText.labelSpecGeneral },
            ...options.labelSpecs.map((spec) => ({ value: String(spec.id), label: spec.name })),
          ]}
        />
        <p className="border-t border-line pt-4 text-small text-muted sm:col-span-2">{brandText.tiersHelp}</p>
        {Array.from({ length: MAX_BRAND_TIERS }, (_, index) => (
          <div key={index} className="grid gap-3 sm:col-span-2 sm:grid-cols-2 sm:gap-5">
            <TextField
              name={`brandTiers.${index}.minQuantity`}
              label={brandText.tierMin(index + 1)}
              values={values}
              inputMode="numeric"
              maxLength={6}
              optional
            />
            <TextField
              name={`brandTiers.${index}.price`}
              label={brandText.tierPrice(index + 1)}
              values={values}
              inputMode="decimal"
              maxLength={14}
              optional
            />
          </div>
        ))}
      </FormSection>

      <FormSection title={form.sections.placement}>
        <TextField
          name="sortOrder"
          label={copy.common.sortOrder}
          help={copy.common.sortOrderHelp}
          values={values}
          inputMode="numeric"
          maxLength={7}
        />
        <div className="flex flex-col gap-3">
          <CheckboxField name="active" label={form.active} values={values} />
          <CheckboxField name="featured" label={form.featured} values={values} />
          <CheckboxField name="isSample" label={form.isSample} values={values} />
        </div>
      </FormSection>

      <FormActions
        submitLabel={mode === "new" ? text.add : copy.common.save}
        cancelHref="/admin/catalogue"
        pending={pending}
      />
    </form>
  );
}
