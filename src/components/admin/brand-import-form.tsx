"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { brandImportAction, type ImportState } from "@/app/admin/catalogue/brand-import/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brand as copy } from "@/content/brand";
import { formatPaise } from "@/lib/format";
import { DataTable, TBody, THead, Td, Th, Tr } from "./data-table";

const text = copy.import;
const idle: ImportState = { status: "idle" };

/**
 * Brand terms CSV import (P2.1): choose a file and preview it (each row
 * with its match or error), then apply. Apply is only offered when every
 * row is ready; the server checks the file again anyway.
 */
export function BrandImportForm() {
  const [state, action, pending] = useActionState(brandImportAction, idle);
  const preview = state.status === "applied" ? undefined : state.preview;

  return (
    <div className="mt-6 flex flex-col gap-6">
      <form
        action={action}
        className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5"
      >
        <p className="text-small text-muted">{text.template}</p>
        <pre className="overflow-x-auto rounded-md bg-surface-alt p-3 text-small text-ink">{text.example}</pre>
        <div className="flex flex-col">
          <label htmlFor="brand-import-file" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.fileLabel}
          </label>
          <input
            id="brand-import-file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            aria-describedby="brand-import-help"
            className="min-h-11 text-sm text-ink file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-surface-alt file:px-4 file:font-bold file:text-brand"
          />
          <p id="brand-import-help" className="mt-1.5 text-small text-muted">
            {text.fileHelp}
          </p>
        </div>
        <Button
          type="submit"
          variant="secondary"
          loading={pending}
          icon={<Upload aria-hidden className="size-4" />}
          className="w-fit max-sm:w-full"
        >
          {text.preview}
        </Button>
      </form>

      {state.message && (
        <FormAlert tone={state.status === "applied" ? "success" : "error"}>{state.message}</FormAlert>
      )}

      {preview && (
        <section aria-labelledby="brand-import-preview" className="flex flex-col gap-3">
          <h2 id="brand-import-preview" className="text-lg font-extrabold text-ink">
            {text.previewTitle}
          </h2>
          <p className="text-small text-muted">{text.summary(preview.valid, preview.invalid)}</p>
          <DataTable caption={text.previewTitle}>
            <THead>
              <Th>{text.columns.line}</Th>
              <Th>{text.columns.product}</Th>
              <Th>{text.columns.minimum}</Th>
              <Th>{text.columns.price}</Th>
              <Th>{text.columns.unit}</Th>
              <Th>{text.columns.result}</Th>
            </THead>
            <TBody>
              {preview.rows.map((row) => (
                <Tr key={row.line}>
                  <Td>{row.line}</Td>
                  <Td label={text.columns.product}>
                    <span className="min-w-0 break-words">
                      <span className="block font-bold text-ink">{row.match?.name ?? row.product}</span>
                      {row.match && <code className="block text-small text-muted">{row.match.slug}</code>}
                    </span>
                  </Td>
                  <Td label={text.columns.minimum}>{row.values?.minQty ?? row.minimum}</Td>
                  <Td label={text.columns.price} className="whitespace-nowrap">
                    {row.values ? formatPaise(row.values.unitPricePaise) : row.price}
                  </Td>
                  <Td label={text.columns.unit}>{row.values?.unitLabel ?? row.unit}</Td>
                  <Td label={text.columns.result}>
                    {row.error ? (
                      <span className="text-small font-bold text-danger">{row.error}</span>
                    ) : (
                      <Badge variant="brand">{text.ok}</Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </DataTable>
          {preview.invalid === 0 ? (
            <form action={action}>
              <input type="hidden" name="intent" value="apply" />
              <input type="hidden" name="csv" value={state.csv ?? ""} />
              <Button type="submit" loading={pending} className="max-sm:w-full">
                {text.apply}
              </Button>
            </form>
          ) : (
            <p className="text-small font-bold text-orange-ink">{text.blocked}</p>
          )}
        </section>
      )}
    </div>
  );
}
