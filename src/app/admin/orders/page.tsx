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
import { AdminPageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { FormAlert } from "@/components/site/auth/form-alert";
import { OrderStatusBadge } from "@/components/site/orders/order-status-badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { admin as copy } from "@/content/admin";
import { cn } from "@/lib/cn";
import { formatDateTime, formatPaise } from "@/lib/format";
import { formatIndianPhone } from "@/lib/phone";
import { listAdminOrders, orderFiltersSchema, orderStatuses } from "@/server/admin/orders";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.orders.metaTitle };

const text = copy.orders;

/** Every order, newest first, with search and filters by status and date. */
export default async function AdminOrdersPage({
  searchParams,
}: PageProps<"/admin/orders">) {
  await requireAdmin();
  const filters = orderFiltersSchema.parse(await searchParams);
  const badRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const { orders, total, page, pageCount } = await listAdminOrders(filters);
  const filtered = Boolean(filters.q || filters.status || filters.from || filters.to);

  return (
    <>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
      />

      <form
        method="get"
        role="search"
        aria-label={text.searchLabel}
        className="mt-6 grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_1fr_1fr_auto]"
      >
        <div className="flex flex-col sm:col-span-2 lg:col-span-1">
          <label htmlFor="filter-q" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.searchLabel}
          </label>
          <span className="relative block">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted"
            />
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
        <div className="flex flex-col sm:col-span-2 lg:col-span-1">
          <label htmlFor="filter-status" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.statusFilter}
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={filters.status ?? ""}
            className={cn(inputClasses, "cursor-pointer")}
          >
            <option value="">{copy.common.all}</option>
            {orderStatuses.map((status) => (
              <option key={status} value={status}>
                {text.statuses[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label htmlFor="filter-from" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.from}
          </label>
          <input
            id="filter-from"
            type="date"
            name="from"
            defaultValue={filters.from ?? ""}
            className={inputClasses}
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="filter-to" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.to}
          </label>
          <input
            id="filter-to"
            type="date"
            name="to"
            defaultValue={filters.to ?? ""}
            className={inputClasses}
          />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
            {copy.common.filter}
          </Button>
          {filtered && (
            <Link href="/admin/orders" className={buttonClasses({ variant: "link" })}>
              {copy.common.clearFilters}
            </Link>
          )}
        </div>
      </form>

      {badRange && <FormAlert className="mt-4">{text.invalidDates}</FormAlert>}

      <p className="mt-4 text-small text-muted">{text.count(total)}</p>
      <DataTable caption={text.title} className="mt-3">
        <THead>
          <Th>{text.columns.id}</Th>
          <Th>{text.columns.customer}</Th>
          <Th>{text.columns.total}</Th>
          <Th>{text.columns.status}</Th>
          <Th>{text.columns.date}</Th>
          <Th>
            <span className="sr-only">{text.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {orders.length === 0 && (
            <EmptyRow colSpan={6}>{filtered ? copy.common.noResults : text.empty}</EmptyRow>
          )}
          {orders.map((order) => (
            <Tr key={order.id}>
              <Td>
                <span className="font-mono font-bold text-ink">{order.number}</span>
                <span className="block text-small text-muted">{text.items(order.itemCount)}</span>
              </Td>
              <Td label={text.columns.customer}>
                <span className="min-w-0">
                  <span className="block font-semibold break-words text-ink">{order.customerName}</span>
                  {order.customerContact && (
                    <span className="block text-small text-muted">
                      {formatIndianPhone(order.customerContact)}
                    </span>
                  )}
                </span>
              </Td>
              <Td label={text.columns.total} className="whitespace-nowrap">
                {formatPaise(order.totalPaise)}
              </Td>
              <Td label={text.columns.status}>
                <OrderStatusBadge status={order.status} labels={text.statuses} />
              </Td>
              <Td label={text.columns.date} className="md:whitespace-nowrap">
                {formatDateTime(order.createdAt)}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2 max-md:mt-2 max-md:*:flex-1 md:justify-end">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    aria-label={text.viewLabel(order.number)}
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
        basePath="/admin/orders"
        params={{ q: filters.q, status: filters.status, from: filters.from, to: filters.to }}
        page={page}
        pageCount={pageCount}
      />
    </>
  );
}
