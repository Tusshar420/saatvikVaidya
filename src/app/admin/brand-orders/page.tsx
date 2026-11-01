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
import { AutoSubmit } from "@/components/admin/auto-submit";
import { Pagination } from "@/components/admin/pagination";
import { SortTh } from "@/components/admin/sort-header";
import { SortSelect } from "@/components/admin/sort-select";
import { FormAlert } from "@/components/site/auth/form-alert";
import { OrderStatusBadge } from "@/components/site/orders/order-status-badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { admin as copy } from "@/content/admin";
import { brand as brandCopy } from "@/content/brand";
import { listHref, sortParam } from "@/lib/admin-sort";
import { cn } from "@/lib/cn";
import { formatDateTime, formatPaise } from "@/lib/format";
import { formatIndianPhone } from "@/lib/phone";
import { listAdminBrandOrders } from "@/server/admin/brand-orders";
import { ORDER_SORT_DEFAULT, orderFiltersSchema, orderStatuses } from "@/server/admin/orders";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: brandCopy.admin.metaTitle };

const text = copy.orders;
const brandText = brandCopy.admin;

/** Build Your Brand orders (P2.1), newest first, with search and filters by status and date. */
export default async function AdminBrandOrdersPage({
  searchParams,
}: PageProps<"/admin/brand-orders">) {
  await requireAdmin("orders", "/admin/brand-orders");
  const filters = orderFiltersSchema.parse(await searchParams);
  const badRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const { orders, total, page, pageCount } = await listAdminBrandOrders(filters);
  const filtered = Boolean(filters.q || filters.status || filters.from || filters.to);
  const params = {
    q: filters.q,
    status: filters.status,
    from: filters.from,
    to: filters.to,
    sort: sortParam(filters.sort, ORDER_SORT_DEFAULT),
  };
  const sortHref = (sort: typeof filters.sort) => listHref("/admin/brand-orders", { ...params, sort: sortParam(sort, ORDER_SORT_DEFAULT) });

  return (
    <>
      <AdminPageHeader
        eyebrow={brandText.eyebrow}
        title={brandText.title}
        description={brandText.description}
      />

      <form
        method="get"
        role="search"
        aria-label={brandText.searchLabel}
        className="mt-6 grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_1fr_1fr_1.3fr]"
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
              placeholder={brandText.searchPlaceholder}
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
        <SortSelect id="filter-sort" sort={filters.sort} options={text.sorts} />
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
            {copy.common.filter}
          </Button>
          {filtered && (
            <Link href={listHref("/admin/brand-orders", { sort: params.sort })} className={buttonClasses({ variant: "link" })}>
              {copy.common.clearFilters}
            </Link>
          )}
        </div>
        <AutoSubmit />
      </form>

      {badRange && <FormAlert className="mt-4">{text.invalidDates}</FormAlert>}

      <p className="mt-4 text-small text-muted">{brandText.count(total)}</p>
      <DataTable caption={brandText.title} className="mt-3">
        <THead>
          <Th>{brandText.columns.order}</Th>
          <Th>{brandText.columns.brand}</Th>
          <Th>{brandText.columns.customer}</Th>
          <SortTh column="total" sort={filters.sort} href={sortHref} firstDir="desc">
            {brandText.columns.total}
          </SortTh>
          <Th>{brandText.columns.status}</Th>
          <SortTh column="date" sort={filters.sort} href={sortHref} firstDir="desc">
            {brandText.columns.date}
          </SortTh>
          <Th>
            <span className="sr-only">{brandText.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {orders.length === 0 && (
            <EmptyRow colSpan={7}>{filtered ? copy.common.noResults : brandText.empty}</EmptyRow>
          )}
          {orders.map((order) => (
            <Tr key={order.id}>
              <Td>
                <span className="font-mono font-bold text-ink">{order.number}</span>
              </Td>
              <Td label={brandText.columns.brand}>
                <span className="min-w-0">
                  <span className="block font-semibold break-words text-ink">{order.brandName}</span>
                  <span className="block text-small break-words text-muted">
                    {order.productName} · {brandText.units(order.quantity, order.unitLabel ?? "")}
                    {order.moreProducts > 0 && ` ${brandCopy.myBrand.more(order.moreProducts)}`}
                  </span>
                </span>
              </Td>
              <Td label={brandText.columns.customer}>
                <span className="min-w-0">
                  <span className="block font-semibold break-words text-ink">{order.customerName}</span>
                  {order.customerContact && (
                    <span className="block text-small text-muted">
                      {formatIndianPhone(order.customerContact)}
                    </span>
                  )}
                </span>
              </Td>
              <Td label={brandText.columns.total} className="whitespace-nowrap">
                {formatPaise(order.totalPaise)}
              </Td>
              <Td label={brandText.columns.status}>
                <OrderStatusBadge status={order.status} labels={text.statuses} />
              </Td>
              <Td label={brandText.columns.date} className="md:whitespace-nowrap">
                {formatDateTime(order.createdAt)}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2 max-md:mt-2 max-md:*:flex-1 md:justify-end">
                  <Link
                    href={`/admin/brand-orders/${order.id}`}
                    aria-label={brandText.viewLabel(order.number)}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    <Eye aria-hidden className="size-4" />
                    {brandText.view}
                  </Link>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
      <Pagination
        basePath="/admin/brand-orders"
        params={params}
        page={page}
        pageCount={pageCount}
      />
    </>
  );
}
