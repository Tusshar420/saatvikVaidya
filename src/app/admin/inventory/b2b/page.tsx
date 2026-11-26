import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DataTable, EmptyRow, TBody, THead, Td, Th, Tr } from "@/components/admin/data-table";
import { FilterBar, FilterSearch, FilterSelect } from "@/components/admin/filter-bar";
import { InventoryStats } from "@/components/admin/inventory-stats";
import { InventoryTabs } from "@/components/admin/inventory-tabs";
import { MovementsTable } from "@/components/admin/inventory-movements";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { SortTh } from "@/components/admin/sort-header";
import { SortSelect } from "@/components/admin/sort-select";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { admin as adminCopy } from "@/content/admin";
import { inventory as copy } from "@/content/inventory";
import { listHref, sortParam } from "@/lib/admin-sort";
import { formatNumber } from "@/lib/format";
import { componentTypes, formatQuantity } from "@/lib/inventory";
import {
  CAN_MAKE_SORT_DEFAULT,
  COMPONENT_SORT_DEFAULT,
  COMPONENT_STATUSES,
  RECIPE_VIEWS,
  filterB2b,
  parseB2bFilters,
  readB2bOverview,
} from "@/server/admin/inventory";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.b2b.metaTitle };

const text = copy.b2b;
const basePath = "/admin/inventory/b2b";

export default async function B2bInventoryPage({ searchParams }: PageProps<"/admin/inventory/b2b">) {
  await requireAdmin("inventory");
  const filters = parseB2bFilters(await searchParams);
  const overview = await readB2bOverview();
  const { movements } = overview;
  const { components, products, productTotal, page, pageCount } = filterB2b(overview, filters);
  const low = overview.components.filter((component) => component.low).length;
  const noRecipe = overview.canMake.filter((product) => product.lineCount === 0).length;

  // Each list keeps the other list's filters in its links and forms.
  const componentParams = {
    q: filters.q ?? undefined,
    type: filters.type ?? undefined,
    status: filters.status === "all" ? undefined : filters.status,
    sort: sortParam(filters.sort, COMPONENT_SORT_DEFAULT),
  };
  const productParams = {
    pq: filters.pq ?? undefined,
    recipe: filters.recipe === "all" ? undefined : filters.recipe,
    psort: sortParam(filters.psort, CAN_MAKE_SORT_DEFAULT),
  };
  const componentsFiltered = Boolean(componentParams.q || componentParams.type || componentParams.status);
  const productsFiltered = Boolean(productParams.pq || productParams.recipe);
  const ppage = page > 1 ? String(page) : undefined;

  return (
    <>
      <AdminPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        action={
          <Link href="/admin/inventory/b2b/new" className={buttonClasses()}>
            <Plus aria-hidden className="size-4.5" />
            {text.components.add}
          </Link>
        }
      />
      <InventoryTabs active="b2b" />
      <p className="mt-4 max-w-3xl text-sm text-muted">{text.intro}</p>
      <InventoryStats
        label={text.metaTitle}
        stats={[
          { label: text.components.title, value: formatNumber(overview.components.length), href: listHref(basePath, productParams, "components") },
          {
            label: text.components.low,
            value: formatNumber(low),
            warn: low > 0,
            href: listHref(basePath, { ...productParams, status: "low" }, "components"),
          },
          {
            label: text.canMake.title,
            value: formatNumber(overview.canMake.length - noRecipe),
            href: listHref(basePath, { ...componentParams, recipe: "set" }, "can-make"),
          },
          {
            label: text.canMake.none,
            value: formatNumber(noRecipe),
            warn: noRecipe > 0,
            href: listHref(basePath, { ...componentParams, recipe: "none" }, "can-make"),
          },
        ]}
      />

      <h2 id="components" className="mt-8 scroll-mt-24 text-h3 text-ink">
        {text.components.title}
      </h2>
      <FilterBar
        label={text.components.filters.label}
        action={`${basePath}#components`}
        hidden={{ ...productParams, ppage }}
        className="sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1.3fr_1.3fr_auto]"
      >
        <FilterSearch
          id="component-q"
          label={text.components.filters.search}
          placeholder={text.components.filters.searchPlaceholder}
          value={filters.q}
        />
        <FilterSelect
          id="component-type"
          name="type"
          label={text.components.filters.type}
          value={filters.type ?? ""}
          options={[
            { value: "", label: adminCopy.common.all },
            ...componentTypes.map((type) => ({ value: type, label: copy.componentTypes[type] ?? type })),
          ]}
        />
        <FilterSelect
          id="component-status"
          name="status"
          label={text.components.filters.status}
          value={filters.status}
          options={COMPONENT_STATUSES.map((status) => ({ value: status, label: text.components.filters.statuses[status] }))}
        />
        <SortSelect id="component-sort" sort={filters.sort} options={text.components.sorts} />
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
            {adminCopy.common.filter}
          </Button>
          {componentsFiltered && (
            <Link href={listHref(basePath, { ...productParams, ppage, sort: componentParams.sort }, "components")} className={buttonClasses({ variant: "link" })}>
              {adminCopy.common.clearFilters}
            </Link>
          )}
        </div>
      </FilterBar>
      <p className="mt-4 text-small text-muted">{text.components.shown(components.length, overview.components.length)}</p>
      <DataTable caption={text.components.title} className="mt-3">
        <THead>
          {(
            [
              ["name", text.components.columns.name],
              ["type", text.components.columns.type],
              ["onHand", text.components.columns.onHand],
              ["reserved", text.components.columns.reserved],
              ["available", text.components.columns.available],
            ] as const
          ).map(([column, label]) => (
            <SortTh
              key={column}
              column={column}
              sort={filters.sort}
              href={(sort) => listHref(basePath, { ...componentParams, ...productParams, ppage, sort: sortParam(sort, COMPONENT_SORT_DEFAULT) }, "components")}
            >
              {label}
            </SortTh>
          ))}
          <Th>{text.components.columns.status}</Th>
          <Th>
            <span className="sr-only">{text.components.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {components.length === 0 && (
            <EmptyRow colSpan={7}>{componentsFiltered ? adminCopy.common.noResults : text.components.empty}</EmptyRow>
          )}
          {components.map((component) => (
            <Tr key={component.id}>
              <Td>
                <span className="font-bold text-ink">{component.name}</span>
                <span className="block text-small text-muted">{text.components.usedBy(component.usedBy)}</span>
              </Td>
              <Td label={text.components.columns.type}>
                {copy.kinds[component.kind]}
                {component.componentType && component.componentType !== "base" && (
                  <span className="block text-small text-muted">{copy.componentTypes[component.componentType] ?? component.componentType}</span>
                )}
              </Td>
              <Td label={text.components.columns.onHand}>{formatQuantity(component.onHand, component.unit)}</Td>
              <Td label={text.components.columns.reserved}>{formatQuantity(component.reserved, component.unit)}</Td>
              <Td label={text.components.columns.available} className="font-bold text-ink">
                {formatQuantity(component.available, component.unit)}
              </Td>
              <Td label={text.components.columns.status}>
                <span className="flex flex-wrap gap-1.5">
                  {!component.active && <Badge variant="soon">{text.components.inactive}</Badge>}
                  {component.madeToOrder && <Badge variant="blue">{text.components.madeToOrder}</Badge>}
                  {component.low && <Badge variant="orange">{text.components.low}</Badge>}
                  {component.available < 0 && <Badge variant="live">{text.components.short}</Badge>}
                  {component.active && !component.low && !component.madeToOrder && component.available >= 0 && (
                    <Badge variant="brand">{text.components.ok}</Badge>
                  )}
                </span>
              </Td>
              <Td>
                <div className="max-md:mt-2 max-md:*:flex-1 md:flex md:justify-end">
                  <Link
                    href={`/admin/inventory/b2b/${component.id}`}
                    aria-label={text.components.manageLabel(component.name)}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    {text.components.manage}
                  </Link>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>

      <h2 id="can-make" className="mt-10 scroll-mt-24 text-h3 text-ink">
        {text.canMake.title}
      </h2>
      <p className="mt-1 text-small text-muted">{text.canMake.help}</p>
      <FilterBar
        label={text.canMake.filters.label}
        action={`${basePath}#can-make`}
        hidden={componentParams}
        className="sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1.3fr_auto]"
      >
        <FilterSearch
          id="product-q"
          name="pq"
          label={text.canMake.filters.search}
          placeholder={text.canMake.filters.searchPlaceholder}
          value={filters.pq}
        />
        <FilterSelect
          id="product-recipe"
          name="recipe"
          label={text.canMake.filters.recipe}
          value={filters.recipe}
          options={RECIPE_VIEWS.map((view) => ({ value: view, label: text.canMake.filters.recipes[view] }))}
        />
        <SortSelect id="product-sort" name="psort" sort={filters.psort} options={text.canMake.sorts} />
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
            {adminCopy.common.filter}
          </Button>
          {productsFiltered && (
            <Link href={listHref(basePath, { ...componentParams, psort: productParams.psort }, "can-make")} className={buttonClasses({ variant: "link" })}>
              {adminCopy.common.clearFilters}
            </Link>
          )}
        </div>
      </FilterBar>
      <p className="mt-4 text-small text-muted">{text.canMake.shown(productTotal, overview.canMake.length)}</p>
      <DataTable caption={text.canMake.title} className="mt-3">
        <THead>
          {(
            [
              ["name", text.canMake.columns.product],
              ["recipe", text.canMake.columns.recipe],
              ["canMake", text.canMake.columns.canMake],
            ] as const
          ).map(([column, label]) => (
            <SortTh
              key={column}
              column={column}
              sort={filters.psort}
              href={(sort) => listHref(basePath, { ...componentParams, ...productParams, psort: sortParam(sort, CAN_MAKE_SORT_DEFAULT) }, "can-make")}
            >
              {label}
            </SortTh>
          ))}
          <Th>{text.canMake.columns.limitedBy}</Th>
          <Th>
            <span className="sr-only">{text.canMake.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {products.length === 0 && (
            <EmptyRow colSpan={5}>{productsFiltered ? adminCopy.common.noResults : text.canMake.empty}</EmptyRow>
          )}
          {products.map((product) => (
            <Tr key={product.id}>
              <Td>
                <span className="font-bold text-ink">{product.name}</span>
                <span className="block text-small text-muted">{product.packSize}</span>
              </Td>
              <Td label={text.canMake.columns.recipe}>
                {product.lineCount === 0 ? <Badge variant="orange">{text.canMake.none}</Badge> : text.canMake.lines(product.lineCount)}
              </Td>
              <Td label={text.canMake.columns.canMake} className="font-bold text-ink">
                {product.lineCount === 0
                  ? "–"
                  : product.makeable === null
                    ? text.canMake.noLimit
                    : text.canMake.units(product.makeable, product.unitLabel)}
              </Td>
              <Td label={text.canMake.columns.limitedBy}>{product.limitedBy ?? "–"}</Td>
              <Td>
                <div className="max-md:mt-2 max-md:*:flex-1 md:flex md:justify-end">
                  <Link
                    href={`/admin/inventory/b2b/recipes/${product.id}`}
                    aria-label={product.lineCount === 0 ? text.canMake.addLabel(product.name) : text.canMake.editLabel(product.name)}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    {product.lineCount === 0 ? text.canMake.add : text.canMake.edit}
                  </Link>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
      <Pagination
        basePath={basePath}
        params={{ ...componentParams, ...productParams }}
        page={page}
        pageCount={pageCount}
        pageParam="ppage"
        hash="can-make"
      />

      <h2 className="mt-10 text-h3 text-ink">{text.recent}</h2>
      <MovementsTable rows={movements} caption={text.recent} showItem />
    </>
  );
}
