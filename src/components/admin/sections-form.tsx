"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { saveSectionsAction } from "@/app/admin/content/home-actions";
import { DataTable, TBody, THead, Td, Th, Tr } from "@/components/admin/data-table";
import { FormError } from "@/components/admin/form-fields";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { inputClasses } from "@/components/ui/field";
import { adminHome } from "@/content/admin-site";
import { cn } from "@/lib/cn";
import { idleForm } from "@/server/admin/form";

const text = adminHome.sections;

export type SectionRow = { key: string; enabled: boolean; sortOrder: number };

/** All homepage sections: shown on/off and order, saved together. */
export function SectionsForm({ rows }: { rows: SectionRow[] }) {
  const [state, action, pending] = useActionState(saveSectionsAction, idleForm);
  const submitted = state.status === "error" ? state.values : undefined;
  return (
    <form action={action} noValidate className="mt-6 flex max-w-4xl flex-col gap-4">
      <DataTable caption={text.title}>
        <THead>
          <Th>{text.columns.section}</Th>
          <Th>{text.columns.shown}</Th>
          <Th>{text.columns.order}</Th>
          <Th>
            <span className="sr-only">{text.columns.heading}</span>
          </Th>
        </THead>
        <TBody>
          {rows.map((row) => {
            const label = text.labels[row.key] ?? row.key;
            return (
              <Tr key={row.key}>
                <Td className="font-bold text-ink">{label}</Td>
                <Td label={text.columns.shown}>
                  <Checkbox
                    name={`enabled:${row.key}`}
                    defaultChecked={submitted ? submitted[`enabled:${row.key}`] === "on" : row.enabled}
                  >
                    <span className="sr-only">
                      {text.shown}: {label}
                    </span>
                  </Checkbox>
                </Td>
                <Td label={text.columns.order}>
                  <input
                    name={`order:${row.key}`}
                    type="number"
                    inputMode="numeric"
                    aria-label={`${text.columns.order}: ${label}`}
                    aria-invalid={state.fieldErrors?.[`order:${row.key}`] ? true : undefined}
                    defaultValue={submitted?.[`order:${row.key}`] ?? String(row.sortOrder)}
                    className={cn(inputClasses, "w-28")}
                  />
                </Td>
                <Td>
                  <Link
                    href={`/admin/content/sections/${row.key}/edit`}
                    aria-label={`${text.edit}: ${label}`}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    <Pencil aria-hidden className="size-4" />
                    {text.edit}
                  </Link>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </DataTable>
      <div role="status" aria-live="polite" className="empty:hidden">
        <FormError state={state} />
        {state.status === "success" && <p className="text-sm font-bold text-success">{state.message}</p>}
      </div>
      <div>
        <Button type="submit" loading={pending} className="max-sm:w-full">
          {text.save}
        </Button>
      </div>
    </form>
  );
}
