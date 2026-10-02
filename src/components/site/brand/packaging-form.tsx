"use client";

import { useActionState } from "react";
import Link from "next/link";
import { savePackagingAction } from "@/app/(site)/launch/actions";
import { TextAreaField, TextField, useFormValues, type FieldValues } from "@/components/admin/form-fields";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { brand as copy } from "@/content/brand";
import { packagingLimits } from "@/lib/brand";
import { idleForm } from "@/server/admin/form";
import { LogoUpload } from "./logo-upload";
import type { LogoPreviewProps } from "./logo-preview";

const text = copy.packaging;

/** Step 2: logo (uploaded on its own) and the label text. */
export function PackagingForm({
  initial,
  logo,
}: {
  initial: FieldValues;
  logo: Omit<LogoPreviewProps, "alt" | "className"> | null;
}) {
  const [state, action, pending] = useActionState(savePackagingAction, idleForm);
  const values = useFormValues(initial, state);
  const fields = text.fields;

  return (
    <div className="flex flex-col gap-6">
      <LogoUpload logo={logo} error={values.error("logo")} />
      <form action={action} noValidate className="flex flex-col gap-5" aria-label={text.title}>
        {state.status === "error" && state.message && <FormAlert>{state.message}</FormAlert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="brandName"
            label={fields.brandName}
            help={fields.brandNameHelp}
            values={values}
            maxLength={packagingLimits.brandName}
            required
            autoComplete="organization"
          />
          <TextField
            name="tagline"
            label={fields.tagline}
            values={values}
            maxLength={packagingLimits.tagline}
            optional
          />
          <TextField
            name="marketedByName"
            label={fields.marketedByName}
            help={fields.marketedByNameHelp}
            values={values}
            maxLength={packagingLimits.marketedByName}
            optional
          />
          <TextField
            name="contactPhone"
            label={fields.contactPhone}
            help={fields.contactPhoneHelp}
            values={values}
            maxLength={packagingLimits.contactPhone}
            inputMode="tel"
            autoComplete="tel"
            optional
          />
          <TextAreaField
            name="marketedByAddress"
            label={fields.marketedByAddress}
            values={values}
            maxLength={packagingLimits.marketedByAddress}
            rows={3}
            optional
            className="sm:col-span-2"
          />
          <TextAreaField
            name="notes"
            label={fields.notes}
            help={fields.notesHelp}
            values={values}
            maxLength={packagingLimits.notes}
            rows={4}
            optional
            className="sm:col-span-2"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 max-sm:flex-col-reverse max-sm:*:w-full">
          <Link href="/launch?step=1" className={buttonClasses({ variant: "secondary" })}>
            {copy.launch.back}
          </Link>
          <Button type="submit" loading={pending} arrow>
            {copy.launch.continue}
          </Button>
        </div>
      </form>
    </div>
  );
}
