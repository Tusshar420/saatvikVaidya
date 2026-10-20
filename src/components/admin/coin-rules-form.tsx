"use client";

import { useActionState } from "react";
import { updateCoinRulesAction } from "@/app/admin/coins/actions";
import { CheckboxField, FormError, FormSection, TextField, useFormValues } from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";
import type { CoinRules } from "@/lib/coins";
import { idleForm } from "@/server/admin/form";

const text = copy.coins;
const fields = text.fields;

/** The Super Coins rules (the "coins.rules" setting). */
export function CoinRulesForm({ rules }: { rules: CoinRules }) {
  const [state, action, pending] = useActionState(updateCoinRulesAction, idleForm);
  const values = useFormValues({ ...rules }, state);
  const number = (name: keyof CoinRules, label: string, help: string) => (
    <TextField
      name={name}
      label={label}
      help={help}
      values={values}
      inputMode="numeric"
      maxLength={9}
      required
    />
  );

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <FormSection title={text.rulesTitle}>
        <CheckboxField
          name="enabled"
          label={fields.enabled}
          help={fields.enabledHelp}
          values={values}
          className="sm:col-span-2"
        />
        {number("earnPerThousandRupees", fields.earnPerThousandRupees, fields.earnPerThousandRupeesHelp)}
        <CheckboxField
          name="earnAfterDelivery"
          label={fields.earnAfterDelivery}
          help={fields.earnAfterDeliveryHelp}
          values={values}
        />
        {number("interestsReward", fields.interestsReward, fields.interestsRewardHelp)}
        {number("detailsReward", fields.detailsReward, fields.detailsRewardHelp)}
        {number("quizReward", fields.quizReward, fields.quizRewardHelp)}
        {number("coinsPerRupee", fields.coinsPerRupee, fields.coinsPerRupeeHelp)}
        {number("maxRedeemPercent", fields.maxRedeemPercent, fields.maxRedeemPercentHelp)}
        {number("maxRedeemCoins", fields.maxRedeemCoins, fields.maxRedeemCoinsHelp)}
        {number("expiryMonths", fields.expiryMonths, fields.expiryMonthsHelp)}
      </FormSection>
      <div role="status" aria-live="polite" className="empty:hidden">
        <FormError state={state} />
        {state.status === "success" && (
          <p className="text-sm font-bold text-success">{state.message}</p>
        )}
      </div>
      <div>
        <Button type="submit" loading={pending} className="max-sm:w-full">
          {text.save}
        </Button>
      </div>
    </form>
  );
}
