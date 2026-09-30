import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import { DataTable, TBody, THead, Th } from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { ComingSoon } from "@/components/ui/empty-state";
import { inputClasses } from "@/components/ui/field";
import { admin as copy } from "@/content/admin";
import { cn } from "@/lib/cn";
import { orderFiltersSchema, orderStatuses } from "@/server/admin/orders";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.orders.metaTitle };

const text = copy.orders;

/**
 * Orders list. There are no orders until checkout exists (P1.3), so this has
 * the filters and columns ready and shows a coming-soon state in place of
 * rows.
 */
export default async function AdminOrdersPage({
  searchParams,
}: PageProps<"/admin/orders">) {
  await requireAdmin();
  const filters = orderFiltersSchema.parse(await searchParams);
  const filtered = Boolean(filters.status || filters.from || filters.to);
  const badRange = Boolean(filters.from && filters.to && filters.from > filters.to);

  return (
    <>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
      />

      <form
        method="get"
        className="mt-6 grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <div className="flex flex-col">
          <label
            htmlFor="filter-status"
            className="mb-1.5 text-xs font-extrabold text-ink"
          >
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
          <label
            htmlFor="filter-from"
            className="mb-1.5 text-xs font-extrabold text-ink"
          >
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
          <label
            htmlFor="filter-to"
            className="mb-1.5 text-xs font-extrabold text-ink"
          >
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
        <div className="flex items-end gap-2 sm:col-span-3 lg:col-span-1">
          <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
            {copy.common.filter}
          </Button>
          {filtered && (
            <Link
              href="/admin/orders"
              className={buttonClasses({ variant: "link" })}
            >
              {copy.common.clearFilters}
            </Link>
          )}
        </div>
      </form>

      {badRange && <FormAlert className="mt-4">{text.invalidDates}</FormAlert>}

      <DataTable caption={text.title} className="mt-6 max-md:hidden">
        <THead>
          <Th>{text.columns.id}</Th>
          <Th>{text.columns.customer}</Th>
          <Th>{text.columns.total}</Th>
          <Th>{text.columns.status}</Th>
          <Th>{text.columns.date}</Th>
        </THead>
        <TBody>{null}</TBody>
      </DataTable>
      <ComingSoon
        as="h2"
        icon={<Package aria-hidden />}
        title={text.soonTitle}
        description={text.soonBody}
        className="mt-4"
      />
    </>
  );
}
