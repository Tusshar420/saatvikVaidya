import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { DataTable, EmptyRow, TBody, THead, Td, Th, Tr } from "@/components/admin/data-table";
import { InventoryStats } from "@/components/admin/inventory-stats";
import { InventoryTabs } from "@/components/admin/inventory-tabs";
import { MovementsTable } from "@/components/admin/inventory-movements";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { AutoSubmit } from "@/components/admin/auto-submit";
import { SortTh } from "@/components/admin/sort-header";
import { SortSelect } from "@/components/admin/sort-select";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { admin as adminCopy } from "@/content/admin";
import { inventory as copy } from "@/content/inventory";
import { listHref, sortParam } from "@/lib/admin-sort";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber } from "@/lib/format";
import { EXPIRY_WARN_DAYS } from "@/lib/inventory";
import { B2C_SORT_DEFAULT, B2C_VIEWS, parseB2cFilters, readB2cOverview, readMovements } from "@/server/admin/inventory";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.b2c.metaTitle };

const text = copy.b2c;
const basePath = "/admin/inventory/b2c";

export default async function B2cInventoryPage({ searchParams }: PageProps<"/admin/inventory/b2c">) {
  await requireAdmin("inventory");
  const filters = parseB2cFilters(await searchParams);
  const [overview, movements] = await Promise.all([
    readB2cOverview(filters),
    readMovements({ item: { kind: "finished" } }, 15),
  ]);
  const { rows, counts } = overview;
  const filtered = Boolean(filters.q || filters.brandId || filters.partner || filters.view !== "all");
  const params = {
    q: filters.q ?? undefined,
    brand: filters.brandId ? String(filters.brandId) : undefined,
    partner: filters.partner ? "1" : undefined,
    view: filters.view === "all" ? undefined : filters.view,
    sort: sortParam(filters.sort, B2C_SORT_DEFAULT),
  };
  const viewHref = (view: (typeof B2C_VIEWS)[number]) => listHref(basePath, { sort: params.sort, view }, "stock");

  return (
    <>
      <AdminPageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <InventoryTabs active="b2c" />
      <p className="mt-4 max-w-3xl text-sm text-muted">{text.intro}</p>

      <InventoryStats
        label={text.metaTitle}
        stats={[
          { label: text.stats.items, value: formatNumber(counts.items), href: listHref(basePath, { sort: params.sort }, "stock") },
          { label: text.stats.low, value: formatNumber(counts.low), warn: counts.low > 0, href: viewHref("low") },
          { label: text.stats.out, value: formatNumber(counts.out), warn: counts.out > 0, href: viewHref("out") },
          {
            label: text.stats.expiring(EXPIRY_WARN_DAYS),
            value: formatNumber(counts.expiringBatches),
            warn: counts.expiringBatches > 0,
            href: viewHref("expiring"),
          },
        ]}
      />
      {counts.expiredBatches > 0 && (
        <p className="mt-3 text-sm font-bold text-danger">
          <Link href={viewHref("expired")} className="underline-offset-4 hover:underline">
            {text.stats.expired}: {formatNumber(counts.expiredBatches)}
          </Link>
        </p>
      )}

      <form
        id="stock"
        method="get"
        action={`${basePath}#stock`}
        role="search"
        aria-label={text.filters.search}
        className="mt-6 grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.2fr_auto] scroll-mt-24"
      >
        <div className="flex flex-col">
          <label htmlFor="inv-q" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.filters.search}
          </label>
          <span className="relative block">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted" />
            <input
              id="inv-q"
              type="search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder={text.filters.searchPlaceholder}
              maxLength={100}
              className={cn(inputClasses, "pl-10")}
            />
          </span>
        </div>
        <div className="flex flex-col">
          <label htmlFor="inv-brand" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.filters.brand}
          </label>
          <select id="inv-brand" name="brand" defaultValue={filters.brandId ?? ""} className={cn(inputClasses, "cursor-pointer")}>
            <option value="">{adminCopy.common.all}</option>
            {overview.brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
                {brand.isPartner ? ` (${text.partner})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label htmlFor="inv-view" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.filters.view}
          </label>
          <select id="inv-view" name="view" defaultValue={filters.view} className={cn(inputClasses, "cursor-pointer")}>
            {B2C_VIEWS.map((view) => (
              <option key={view} value={view}>
                {text.filters.views[view]}
              </option>
            ))}
          </select>
        </div>
        <SortSelect id="inv-sort" sort={filters.sort} options={text.filters.sorts} />
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
            {adminCopy.common.filter}
          </Button>
          {filtered && (
            <Link href={listHref(basePath, { sort: params.sort }, "stock")} className={buttonClasses({ variant: "link" })}>
              {adminCopy.common.clearFilters}
            </Link>
          )}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink sm:col-span-2 lg:col-span-5">
          <input type="checkbox" name="partner" value="1" defaultChecked={filters.partner} className="size-4.5 accent-brand" />
          {text.filters.partnerOnly}
        </label>
        <AutoSubmit />
      </form>

      <p className="mt-4 text-small text-muted">{text.count(overview.total)}</p>
      <DataTable caption={text.metaTitle} className="mt-3">
        <THead>
          {(
            [
              ["name", text.columns.product],
              ["brand", text.columns.partner],
              ["onHand", text.columns.onHand],
              ["reserved", text.columns.reserved],
              ["available", text.columns.available],
              ["expiry", text.columns.expiry],
            ] as const
          ).map(([column, label]) => (
            <SortTh
              key={column}
              column={column}
              sort={filters.sort}
              href={(sort) => listHref(basePath, { ...params, sort: sortParam(sort, B2C_SORT_DEFAULT) }, "stock")}
            >
              {label}
            </SortTh>
          ))}
          <Th>{text.columns.status}</Th>
          <Th>
            <span className="sr-only">{text.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {rows.length === 0 && <EmptyRow colSpan={8}>{filtered ? adminCopy.common.noResults : text.empty}</EmptyRow>}
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td>
                <span className="font-bold text-ink">{row.name}</span>
                {row.slug && <code className="block text-small text-muted">{row.slug}</code>}
              </Td>
              <Td label={text.columns.partner}>
                {row.brandName ? (
                  <span className="flex flex-wrap items-center gap-2">
                    {row.brandName}
                    {row.isPartner && <Badge variant="blue">{text.partner}</Badge>}
                  </span>
                ) : (
                  text.noBrand
                )}
              </Td>
              <Td label={text.columns.onHand}>{formatNumber(row.onHand)}</Td>
              <Td label={text.columns.reserved}>{formatNumber(row.reserved)}</Td>
              <Td label={text.columns.available} className="font-bold text-ink">
                {formatNumber(row.sellable)}
              </Td>
              <Td label={text.columns.expiry} className="whitespace-nowrap">
                {row.nearestExpiry ? formatDate(row.nearestExpiry) : text.noExpiry}
              </Td>
              <Td label={text.columns.status}>
                <span className="flex flex-wrap gap-1.5">
                  {row.sellable === 0 ? <Badge variant="live">{text.badges.out}</Badge> : row.low && <Badge variant="orange">{text.badges.low}</Badge>}
                  {row.soonBatches > 0 && <Badge variant="gold">{text.badges.soon(row.soonBatches)}</Badge>}
                  {row.expiredBatches > 0 && <Badge variant="live">{text.badges.expired(row.expiredBatches)}</Badge>}
                  {row.sellable > 0 && !row.low && row.soonBatches === 0 && row.expiredBatches === 0 && <Badge variant="brand">{text.badges.ok}</Badge>}
                </span>
              </Td>
              <Td>
                <div className="max-md:mt-2 max-md:*:flex-1 md:flex md:justify-end">
                  <Link
                    href={`/admin/inventory/b2c/${row.id}`}
                    aria-label={text.manageLabel(row.name)}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    {text.manage}
                  </Link>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
      <Pagination
        basePath="/admin/inventory/b2c"
        params={params}
        page={overview.page}
        pageCount={overview.pageCount}
        hash="stock"
      />

      <h2 className="mt-10 text-h3 text-ink">{text.recent}</h2>
      <MovementsTable rows={movements} caption={text.recent} showItem />
    </>
  );
}
