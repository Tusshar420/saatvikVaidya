import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { AssistedStatusBadge } from "@/components/admin/assisted-order-bits";
import { AutoSubmit } from "@/components/admin/auto-submit";
import { DataTable, EmptyRow, TBody, THead, Td, Th, Tr } from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { assistedOrders as copy } from "@/content/assisted-orders";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { formatIndianPhone } from "@/lib/phone";
import {
  assistedFilterStatuses,
  assistedFiltersSchema,
  listAssistedOrders,
} from "@/server/assisted-orders/assisted-orders";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.admin.metaTitle };

const text = copy.admin;

/** Orders staff prepared for customers, newest first, with a status filter. */
export default async function AssistedOrdersPage({ searchParams }: PageProps<"/admin/assisted-orders">) {
  await requireAdmin("orders", "/admin/assisted-orders");
  const filters = assistedFiltersSchema.parse(await searchParams);
  const { rows, page, pageCount } = await listAssistedOrders(filters);

  return (
    <>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
        action={
          <Link href="/admin/assisted-orders/new" className={buttonClasses()}>
            <Plus aria-hidden className="size-4" />
            {text.newButton}
          </Link>
        }
      />

      <form
        method="get"
        className="mt-6 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-end"
      >
        <div className="flex flex-col sm:w-64">
          <label htmlFor="filter-status" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.statusFilter}
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={filters.status ?? ""}
            className={cn(inputClasses, "cursor-pointer")}
          >
            <option value="">{text.all}</option>
            {assistedFilterStatuses.map((status) => (
              <option key={status} value={status}>
                {copy.statuses[status]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          {text.filter}
        </Button>
        <AutoSubmit />
      </form>

      <DataTable caption={text.caption} className="mt-5">
        <THead>
          <Th>{text.columns.customer}</Th>
          <Th>{text.columns.items}</Th>
          <Th>{text.columns.status}</Th>
          <Th>{text.columns.preparedBy}</Th>
          <Th>{text.columns.created}</Th>
          <Th>
            <span className="sr-only">{text.columns.open}</span>
          </Th>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <EmptyRow colSpan={6}>{filters.status ? text.emptyFiltered : text.empty}</EmptyRow>
          )}
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td>
                <span className="block font-semibold break-words text-ink">{row.customer.name}</span>
                {row.customer.phoneNumber && (
                  <span className="block text-small text-muted">{formatIndianPhone(row.customer.phoneNumber)}</span>
                )}
              </Td>
              <Td label={text.columns.items}>{text.itemCount(row.itemCount)}</Td>
              <Td label={text.columns.status}>
                <span className="flex flex-col items-start gap-1">
                  <AssistedStatusBadge status={row.status} />
                  {row.order && (
                    <Link
                      href={`/admin/orders/${row.order.id}`}
                      className="font-mono text-small font-bold text-brand hover:underline"
                    >
                      {row.order.number}
                    </Link>
                  )}
                </span>
              </Td>
              <Td label={text.columns.preparedBy}>{row.preparedBy ?? text.unknownStaff}</Td>
              <Td label={text.columns.created} className="md:whitespace-nowrap">
                {formatDateTime(row.createdAt)}
              </Td>
              <Td>
                <div className="flex max-md:mt-2 max-md:*:flex-1 md:justify-end">
                  <Link
                    href={`/admin/assisted-orders/${row.id}`}
                    aria-label={text.openLabel(row.customer.name)}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    <Eye aria-hidden className="size-4" />
                    {text.columns.open}
                  </Link>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
      <Pagination
        basePath="/admin/assisted-orders"
        params={{ status: filters.status }}
        page={page}
        pageCount={pageCount}
      />
    </>
  );
}
