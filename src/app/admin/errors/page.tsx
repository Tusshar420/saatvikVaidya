import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Search } from "lucide-react";
import {
  DataTable,
  EmptyRow,
  TBody,
  THead,
  Td,
  Th,
  Tr,
} from "@/components/admin/data-table";
import { ErrorStatusBadge } from "@/components/admin/error-status-badge";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { admin as adminCopy } from "@/content/admin";
import { errorLog as text } from "@/content/errors";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import {
  errorFiltersSchema,
  errorSorts,
  errorSources,
  errorStatuses,
  listErrors,
} from "@/server/admin/errors";
import { requireAdmin } from "@/server/auth/session";
import { deleteOldErrors } from "@/server/errors/record";

export const metadata: Metadata = { title: text.metaTitle };

const label = "mb-1.5 text-xs font-extrabold text-ink";

/** Grouped errors, newest or most frequent first, with filters. */
export default async function AdminErrorsPage({ searchParams }: PageProps<"/admin/errors">) {
  await requireAdmin("errors", "/admin/errors");
  const filters = errorFiltersSchema.parse(await searchParams);
  // No scheduler on the host: opening the log also applies the retention rule.
  await deleteOldErrors();
  const badRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const { errors, total, page, pageCount } = await listErrors(filters);
  const filtered = Boolean(
    filters.q || filters.source || filters.status || filters.route || filters.from || filters.to,
  );

  return (
    <>
      <AdminPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} />

      <form
        method="get"
        role="search"
        aria-label={text.filterLabel}
        className="mt-6 grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="flex flex-col sm:col-span-2">
          <label htmlFor="filter-q" className={label}>
            {text.searchLabel}
          </label>
          <span className="relative block">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted" />
            <input
              id="filter-q"
              type="search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder={text.searchPlaceholder}
              maxLength={100}
              className={cn(inputClasses, "pl-10")}
            />
          </span>
        </div>
        <div className="flex flex-col sm:col-span-2">
          <label htmlFor="filter-route" className={label}>
            {text.routeFilter}
          </label>
          <input
            id="filter-route"
            type="text"
            name="route"
            defaultValue={filters.route ?? ""}
            placeholder={text.routePlaceholder}
            maxLength={100}
            className={inputClasses}
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="filter-source" className={label}>
            {text.sourceFilter}
          </label>
          <select id="filter-source" name="source" defaultValue={filters.source ?? ""} className={cn(inputClasses, "cursor-pointer")}>
            <option value="">{adminCopy.common.all}</option>
            {errorSources.map((source) => (
              <option key={source} value={source}>
                {text.sources[source]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label htmlFor="filter-status" className={label}>
            {text.statusFilter}
          </label>
          <select id="filter-status" name="status" defaultValue={filters.status ?? ""} className={cn(inputClasses, "cursor-pointer")}>
            <option value="">{adminCopy.common.all}</option>
            {errorStatuses.map((status) => (
              <option key={status} value={status}>
                {text.statuses[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label htmlFor="filter-from" className={label}>
            {text.from}
          </label>
          <input id="filter-from" type="date" name="from" defaultValue={filters.from ?? ""} className={inputClasses} />
        </div>
        <div className="flex flex-col">
          <label htmlFor="filter-to" className={label}>
            {text.to}
          </label>
          <input id="filter-to" type="date" name="to" defaultValue={filters.to ?? ""} className={inputClasses} />
        </div>
        <div className="flex flex-col">
          <label htmlFor="filter-sort" className={label}>
            {text.sortLabel}
          </label>
          <select id="filter-sort" name="sort" defaultValue={filters.sort} className={cn(inputClasses, "cursor-pointer")}>
            {errorSorts.map((sort) => (
              <option key={sort} value={sort}>
                {text.sorts[sort]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
          <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
            {adminCopy.common.filter}
          </Button>
          {filtered && (
            <Link href="/admin/errors" className={buttonClasses({ variant: "link" })}>
              {adminCopy.common.clearFilters}
            </Link>
          )}
        </div>
      </form>

      {badRange && <FormAlert className="mt-4">{text.invalidDates}</FormAlert>}

      <p className="mt-4 text-small text-muted">{text.count(total)}</p>
      <DataTable caption={text.title} className="mt-3">
        <THead>
          <Th>{text.columns.error}</Th>
          <Th>{text.columns.where}</Th>
          <Th>{text.columns.status}</Th>
          <Th>{text.columns.count}</Th>
          <Th>{text.columns.lastSeen}</Th>
          <Th>
            <span className="sr-only">{text.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {errors.length === 0 && (
            <EmptyRow colSpan={6}>{filtered ? adminCopy.common.noResults : text.empty}</EmptyRow>
          )}
          {errors.map((error) => (
            <Tr key={error.id} data-testid="error-row">
              <Td className="md:max-w-md">
                <Link href={`/admin/errors/${error.id}`} className="block font-bold break-words text-ink hover:text-teal">
                  {error.message}
                </Link>
                <span className="block font-mono text-small break-all text-muted">
                  {error.method ? `${error.method} ` : ""}
                  {error.route}
                  {error.statusCode ? ` · ${error.statusCode}` : ""}
                </span>
              </Td>
              <Td label={text.columns.where}>
                <Badge variant={error.source === "server" ? "blue" : "gold"}>{text.sources[error.source]}</Badge>
              </Td>
              <Td label={text.columns.status}>
                <ErrorStatusBadge status={error.status} />
              </Td>
              <Td label={text.columns.count} className="font-bold whitespace-nowrap">
                {error.count.toLocaleString("en-IN")}
              </Td>
              <Td label={text.columns.lastSeen} className="md:whitespace-nowrap">
                {formatDateTime(error.lastSeenAt)}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2 max-md:mt-2 max-md:*:flex-1 md:justify-end">
                  <Link
                    href={`/admin/errors/${error.id}`}
                    aria-label={text.viewLabel(error.message)}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    <Eye aria-hidden className="size-4" />
                    {text.view}
                  </Link>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
      <Pagination
        basePath="/admin/errors"
        params={{
          q: filters.q,
          source: filters.source,
          status: filters.status,
          route: filters.route,
          from: filters.from,
          to: filters.to,
          sort: filters.sort === "newest" ? undefined : filters.sort,
        }}
        page={page}
        pageCount={pageCount}
      />
    </>
  );
}
