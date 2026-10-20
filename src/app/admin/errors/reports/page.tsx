import type { Metadata } from "next";
import Link from "next/link";
import { Eye, ImageIcon, Search } from "lucide-react";
import {
  DataTable,
  EmptyRow,
  TBody,
  THead,
  Td,
  Th,
  Tr,
} from "@/components/admin/data-table";
import { ErrorLogTabs } from "@/components/admin/error-log-tabs";
import { ErrorStatusBadge } from "@/components/admin/error-status-badge";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { admin as adminCopy } from "@/content/admin";
import { bugReportsAdmin as text } from "@/content/bug-reports";
import { errorLog } from "@/content/errors";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { pagePathOf } from "@/lib/bug-report";
import { countNewReports, listReports, reportFiltersSchema } from "@/server/admin/bug-reports";
import { errorStatuses } from "@/server/admin/errors";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: text.metaTitle };

const label = "mb-1.5 text-xs font-extrabold text-ink";

/** Problem reports from visitors, newest first, with filters: the error log's Reports tab. */
export default async function AdminBugReportsPage({ searchParams }: PageProps<"/admin/errors/reports">) {
  await requireAdmin("errors", "/admin/errors/reports");
  const filters = reportFiltersSchema.parse(await searchParams);
  const badRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const [{ reports, total, page, pageCount }, newReports] = await Promise.all([
    listReports(filters),
    countNewReports(),
  ]);
  const filtered = Boolean(filters.q || filters.status || filters.from || filters.to);

  return (
    <>
      <AdminPageHeader eyebrow={text.eyebrow} title={errorLog.title} description={text.description} />
      <ErrorLogTabs active="reports" newReports={newReports} />

      <form
        method="get"
        role="search"
        aria-label={text.filterLabel}
        className="mt-5 grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="flex flex-col sm:col-span-2">
          <label htmlFor="report-filter-q" className={label}>
            {text.searchLabel}
          </label>
          <span className="relative block">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted" />
            <input
              id="report-filter-q"
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
          <label htmlFor="report-filter-status" className={label}>
            {errorLog.statusFilter}
          </label>
          <select id="report-filter-status" name="status" defaultValue={filters.status ?? ""} className={cn(inputClasses, "cursor-pointer")}>
            <option value="">{adminCopy.common.all}</option>
            {errorStatuses.map((status) => (
              <option key={status} value={status}>
                {errorLog.statuses[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label htmlFor="report-filter-from" className={label}>
            {text.from}
          </label>
          <input id="report-filter-from" type="date" name="from" defaultValue={filters.from ?? ""} className={inputClasses} />
        </div>
        <div className="flex flex-col">
          <label htmlFor="report-filter-to" className={label}>
            {text.to}
          </label>
          <input id="report-filter-to" type="date" name="to" defaultValue={filters.to ?? ""} className={inputClasses} />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2">
          <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
            {adminCopy.common.filter}
          </Button>
          {filtered && (
            <Link href="/admin/errors/reports" className={buttonClasses({ variant: "link" })}>
              {adminCopy.common.clearFilters}
            </Link>
          )}
        </div>
      </form>

      {badRange && <FormAlert className="mt-4">{errorLog.invalidDates}</FormAlert>}

      <p className="mt-4 text-small text-muted">{text.count(total)}</p>
      <DataTable caption={text.title} className="mt-3">
        <THead>
          <Th>{text.columns.report}</Th>
          <Th>{text.columns.from}</Th>
          <Th>{text.columns.status}</Th>
          <Th>{text.columns.errors}</Th>
          <Th>{text.columns.received}</Th>
          <Th>
            <span className="sr-only">{text.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {reports.length === 0 && (
            <EmptyRow colSpan={6}>{filtered ? adminCopy.common.noResults : text.empty}</EmptyRow>
          )}
          {reports.map((report) => (
            <Tr key={report.id} data-testid="report-row">
              <Td className="md:max-w-md">
                <Link
                  href={`/admin/errors/reports/${report.id}`}
                  className="line-clamp-3 font-bold break-words text-ink hover:text-brand"
                >
                  {report.description}
                </Link>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-small text-muted">
                  {report.pageUrl && <span className="font-mono break-all">{pagePathOf(report.pageUrl)}</span>}
                  {report.screenshotKey && (
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon aria-hidden className="size-3.5" />
                      {text.hasScreenshot}
                    </span>
                  )}
                </span>
              </Td>
              <Td label={text.columns.from} className="break-words">
                {report.user ? (
                  report.user.name
                ) : (
                  <>
                    {text.guest}
                    {report.contactEmail && (
                      <span className="block text-small break-all text-muted">{report.contactEmail}</span>
                    )}
                  </>
                )}
              </Td>
              <Td label={text.columns.status}>
                <ErrorStatusBadge status={report.status} />
              </Td>
              <Td label={text.columns.errors} className="whitespace-nowrap">
                {text.linkedCount(report._count.errors)}
              </Td>
              <Td label={text.columns.received} className="md:whitespace-nowrap">
                {formatDateTime(report.createdAt)}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2 max-md:mt-2 max-md:*:flex-1 md:justify-end">
                  <Link
                    href={`/admin/errors/reports/${report.id}`}
                    aria-label={text.viewLabel(report.id)}
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
        basePath="/admin/errors/reports"
        params={{ q: filters.q, status: filters.status, from: filters.from, to: filters.to }}
        page={page}
        pageCount={pageCount}
      />
    </>
  );
}
