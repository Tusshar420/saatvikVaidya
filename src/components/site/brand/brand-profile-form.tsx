"use client";

import { useActionState, useEffect, useState } from "react";
import { saveBrandProfileAction } from "@/app/(site)/launch/actions";
import { CheckboxField, TextAreaField, TextField, useFormValues } from "@/components/admin/form-fields";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { brand as copy } from "@/content/brand";
import { isHexColour, profileLimits } from "@/lib/label";
import { fieldValuesOf, idleForm } from "@/server/admin/form";
import type { BrandProfileView } from "@/server/brand/profiles";
import { LogoUpload } from "./logo-upload";

const text = copy.profiles;
const fields = text.fields;
const groupClasses = "flex flex-col gap-5 rounded-lg border border-line p-4 sm:p-5";

/**
 * A brand's form: the shared label details. A new brand is saved first and
 * then gets its logo (the form carries on as the edit form of the new brand,
 * which `onSaved` tells the list about).
 */
export function BrandProfileForm({
  profile,
  onSaved,
  onCancel,
}: {
  profile: BrandProfileView | null;
  /** Called after each successful save, with the brand's id. */
  onSaved: (id: number, created: boolean) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(saveBrandProfileAction, idleForm);
  const values = useFormValues(
    profile ? { ...fieldValuesOf(profile), makeDefault: profile.isDefault } : { makeDefault: false },
    state,
  );

  useEffect(() => {
    if (state.status === "success" && state.values?.id) {
      onSaved(Number(state.values.id), profile === null);
    }
    // onSaved changes with every render of the list; only a new result matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const title = profile ? text.form.editTitle(profile.profileName) : text.form.newTitle;
  return (
    <div className="flex flex-col gap-5 rounded-xl border border-teal/50 bg-surface p-4 shadow-card sm:p-6">
      <div>
        <h3 id="brand-form-title" className="text-h3 text-ink">
          {title}
        </h3>
        <p className="mt-1 text-small text-muted">{text.form.line}</p>
      </div>
      {profile && (
        <LogoUpload
          profileId={profile.id}
          brandName={profile.brandName}
          logo={
            profile.logo
              ? {
                  src: `/api/launch/logo?profile=${profile.id}&v=${profile.updatedAt.getTime()}`,
                  ...profile.logo,
                }
              : null
          }
        />
      )}
      <form action={action} noValidate aria-labelledby="brand-form-title" className="flex flex-col gap-5">
        {profile && <input type="hidden" name="id" value={profile.id} />}
        {state.status === "error" && state.message && <FormAlert>{state.message}</FormAlert>}

        <fieldset className={groupClasses}>
          <legend className="px-1 text-xs font-extrabold text-ink uppercase">{text.form.groups.identity}</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              name="profileName"
              label={fields.profileName}
              help={fields.profileNameHelp}
              values={values}
              maxLength={profileLimits.profileName}
              required
            />
            <TextField
              name="brandName"
              label={fields.brandName}
              help={fields.brandNameHelp}
              values={values}
              maxLength={profileLimits.brandName}
              required
              autoComplete="organization"
            />
            <TextField
              name="tagline"
              label={fields.tagline}
              values={values}
              maxLength={profileLimits.tagline}
              optional
              className="sm:col-span-2"
            />
          </div>
        </fieldset>

        <fieldset className={groupClasses}>
          <legend className="px-1 text-xs font-extrabold text-ink uppercase">{text.form.groups.descriptions}</legend>
          <TextField
            name="shortDescription"
            label={fields.shortDescription}
            help={fields.shortDescriptionHelp}
            values={values}
            maxLength={profileLimits.shortDescription}
            optional
          />
          <TextAreaField
            name="longDescription"
            label={fields.longDescription}
            help={fields.longDescriptionHelp}
            values={values}
            maxLength={profileLimits.longDescription}
            rows={4}
            optional
          />
        </fieldset>

        <fieldset className={groupClasses}>
          <legend className="px-1 text-xs font-extrabold text-ink uppercase">{text.form.groups.company}</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              name="marketedByName"
              label={fields.marketedByName}
              help={fields.marketedByNameHelp}
              values={values}
              maxLength={profileLimits.marketedByName}
              optional
            />
            <TextField
              name="contactPhone"
              label={fields.contactPhone}
              help={fields.contactPhoneHelp}
              values={values}
              maxLength={profileLimits.contactPhone}
              inputMode="tel"
              autoComplete="tel"
              optional
            />
            <TextAreaField
              name="marketedByAddress"
              label={fields.marketedByAddress}
              values={values}
              maxLength={profileLimits.marketedByAddress}
              rows={3}
              optional
              className="sm:col-span-2"
            />
            <TextAreaField
              name="licenceNumbers"
              label={fields.licenceNumbers}
              help={fields.licenceNumbersHelp}
              values={values}
              maxLength={profileLimits.licenceNumbers}
              rows={3}
              optional
              className="sm:col-span-2"
            />
          </div>
        </fieldset>

        <fieldset className={groupClasses}>
          <legend className="px-1 text-xs font-extrabold text-ink uppercase">{text.form.groups.colours}</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <ColourField
              key={`primary-${values.text("primaryColour")}`}
              name="primaryColour"
              label={fields.primaryColour}
              initial={values.text("primaryColour")}
              error={values.error("primaryColour")}
            />
            <ColourField
              key={`secondary-${values.text("secondaryColour")}`}
              name="secondaryColour"
              label={fields.secondaryColour}
              initial={values.text("secondaryColour")}
              error={values.error("secondaryColour")}
            />
          </div>
        </fieldset>

        <CheckboxField name="makeDefault" label={text.form.makeDefault} values={values} />

        <div className="flex flex-wrap items-center gap-3 max-sm:flex-col-reverse max-sm:*:w-full">
          <Button variant="secondary" onClick={onCancel}>
            {text.form.cancel}
          </Button>
          <Button type="submit" loading={pending}>
            {profile ? text.form.save : text.form.saveNew}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** A colour picker that can also be left empty (an empty colour is sent as blank). */
function ColourField({
  name,
  label,
  initial,
  error,
}: {
  name: string;
  label: string;
  initial: string;
  error?: string;
}) {
  const [value, setValue] = useState(isHexColour(initial) ? initial.toLowerCase() : "");
  const id = `colour-${name}`;
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="mb-1.5 block text-xs font-extrabold text-ink">
        {label}
        <span className="ml-1.5 font-medium text-muted">({copy.packaging.optional})</span>
      </label>
      <input type="hidden" name={name} value={value} />
      <div className="flex min-h-12 items-center gap-3">
        <input
          id={id}
          type="color"
          value={value || fields.colourStart}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-state`}
          onChange={(event) => setValue(event.target.value.toLowerCase())}
          className="size-12 shrink-0 cursor-pointer rounded-md border border-line bg-surface p-1"
        />
        <span id={`${id}-state`} className="min-w-0 text-sm text-ink">
          {value ? value.toUpperCase() : <span className="text-muted">{fields.colourNone}</span>}
        </span>
        {value && (
          <Button variant="link" size="sm" aria-label={`${fields.colourClear}: ${label}`} onClick={() => setValue("")}>
            {fields.colourClear}
          </Button>
        )}
      </div>
      {error && <p className="mt-1.5 text-small font-medium text-danger">{error}</p>}
    </div>
  );
}
