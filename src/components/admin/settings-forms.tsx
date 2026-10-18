"use client";

import { useActionState, type ReactNode } from "react";
import {
  saveAnnouncementAction,
  saveContactAction,
  saveDiscountAction,
  saveSellerAction,
  saveShippingAction,
  saveSwitchesAction,
} from "@/app/admin/settings/actions";
import {
  CheckboxField,
  FormError,
  FormSection,
  SelectField,
  TextAreaField,
  TextField,
  useFormValues,
  type FieldValues,
} from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { adminSettings as copy } from "@/content/admin-site";
import { indianStates } from "@/lib/india";
import { idleForm, type FormState } from "@/server/admin/form";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/** One group of settings: its own form, Save button and result message. */
function SettingsForm({
  action,
  title,
  initial,
  children,
}: {
  action: Action;
  title: string;
  initial: FieldValues;
  children: (values: ReturnType<typeof useFormValues>) => ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const values = useFormValues(initial, state);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <FormSection title={title}>{children(values)}</FormSection>
      <div role="status" aria-live="polite" className="empty:hidden">
        <FormError state={state} />
        {state.status === "success" && (
          <p className="text-sm font-bold text-green">{state.message}</p>
        )}
      </div>
      <div>
        <Button type="submit" loading={pending} className="max-sm:w-full">
          {copy.save}
        </Button>
      </div>
    </form>
  );
}

export type SettingsFormsProps = {
  contact: { phone: string; supportNote: string; footerTagline: string; popularSearches: string };
  announcement: { enabled: boolean; text: string; href: string };
  shipping: { fee: string; freeFrom: string };
  discount: { percent: string };
  seller: {
    legalName: string;
    addressLines: string;
    city: string;
    stateCode: string;
    pincode: string;
    gstin: string;
  };
  switches: {
    checkout: boolean;
    coins: boolean;
    ebooks: boolean;
    maintenance: boolean;
    maintenanceMessage: string;
  };
};

export function SettingsForms({ contact, announcement, shipping, discount, seller, switches }: SettingsFormsProps) {
  const g = copy.groups;
  return (
    <div className="mt-6 flex max-w-4xl flex-col gap-8">
      <SettingsForm action={saveSwitchesAction} title={g.switches.title} initial={switches}>
        {(values) => (
          <>
            <CheckboxField name="checkout" label={g.switches.checkout} help={g.switches.checkoutHelp} values={values} />
            <CheckboxField name="coins" label={g.switches.coins} help={g.switches.coinsHelp} values={values} />
            <CheckboxField name="ebooks" label={g.switches.ebooks} help={g.switches.ebooksHelp} values={values} />
            <CheckboxField
              name="maintenance"
              label={g.switches.maintenance}
              help={g.switches.maintenanceHelp}
              values={values}
            />
            <TextAreaField
              name="maintenanceMessage"
              label={g.switches.maintenanceMessage}
              help={g.switches.maintenanceMessageHelp}
              values={values}
              maxLength={300}
              className="sm:col-span-2"
            />
          </>
        )}
      </SettingsForm>

      <SettingsForm action={saveContactAction} title={g.contact.title} initial={contact}>
        {(values) => (
          <>
            <TextField name="phone" label={g.contact.phone} help={g.contact.phoneHelp} values={values} maxLength={20} required />
            <TextField
              name="footerTagline"
              label={g.contact.footerTagline}
              help={g.contact.footerTaglineHelp}
              values={values}
              maxLength={200}
              required
            />
            <TextAreaField
              name="supportNote"
              label={g.contact.supportNote}
              help={g.contact.supportNoteHelp}
              values={values}
              maxLength={300}
              className="sm:col-span-2"
            />
            <TextAreaField
              name="popularSearches"
              label={g.contact.popularSearches}
              help={g.contact.popularSearchesHelp}
              values={values}
              rows={4}
              className="sm:col-span-2"
            />
          </>
        )}
      </SettingsForm>

      <SettingsForm action={saveAnnouncementAction} title={g.announcement.title} initial={announcement}>
        {(values) => (
          <>
            <CheckboxField
              name="enabled"
              label={g.announcement.enabled}
              help={g.announcement.enabledHelp}
              values={values}
              className="sm:col-span-2"
            />
            <TextField name="text" label={g.announcement.text} help={g.announcement.textHelp} values={values} maxLength={200} optional />
            <TextField name="href" label={g.announcement.href} help={g.announcement.hrefHelp} values={values} maxLength={200} optional />
          </>
        )}
      </SettingsForm>

      <SettingsForm action={saveShippingAction} title={g.shipping.title} initial={shipping}>
        {(values) => (
          <>
            <TextField name="fee" label={g.shipping.fee} help={g.shipping.feeHelp} values={values} inputMode="decimal" maxLength={12} required />
            <TextField
              name="freeFrom"
              label={g.shipping.freeFrom}
              help={g.shipping.freeFromHelp}
              values={values}
              inputMode="decimal"
              maxLength={12}
              optional
            />
          </>
        )}
      </SettingsForm>

      <SettingsForm action={saveDiscountAction} title={g.discount.title} initial={discount}>
        {(values) => (
          <TextField name="percent" label={g.discount.percent} help={g.discount.percentHelp} values={values} inputMode="numeric" maxLength={2} required />
        )}
      </SettingsForm>

      <SettingsForm action={saveSellerAction} title={g.seller.title} initial={seller}>
        {(values) => (
          <>
            <TextField name="legalName" label={g.seller.legalName} values={values} maxLength={120} required className="sm:col-span-2" />
            <TextAreaField
              name="addressLines"
              label={g.seller.addressLines}
              help={g.seller.addressLinesHelp}
              values={values}
              className="sm:col-span-2"
            />
            <TextField name="city" label={g.seller.city} values={values} maxLength={100} required />
            <SelectField
              name="stateCode"
              label={g.seller.stateCode}
              values={values}
              options={indianStates.map((state) => ({ value: state.code, label: state.name }))}
            />
            <TextField name="pincode" label={g.seller.pincode} values={values} inputMode="numeric" maxLength={6} required />
            <TextField name="gstin" label={g.seller.gstin} help={g.seller.gstinHelp} values={values} maxLength={15} required />
          </>
        )}
      </SettingsForm>
    </div>
  );
}
