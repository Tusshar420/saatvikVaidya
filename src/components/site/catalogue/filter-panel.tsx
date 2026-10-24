"use client";

import { useId, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { catalogue as copy } from "@/content/catalogue";
import { catalogueSorts } from "@/lib/catalogue";
import { cn } from "@/lib/cn";
import type { CatalogueFacets, CatalogueFilters } from "@/server/catalogue/products";

export type FilterPanelProps = {
  facets: CatalogueFacets;
  filters: CatalogueFilters;
  /** How many filters are on (shown on the phone toggle). */
  activeCount: number;
};

const control =
  "h-11 w-full min-w-0 cursor-pointer rounded-md border border-line bg-surface px-3 text-small font-bold text-muted transition hover:border-line-strong focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/**
 * The v2 FilterBar (`.shop-bar`): search, brand and product form in one row,
 * then practice area, sort and Apply. A plain GET form, so the URL holds the
 * filters. On phones the search sits on its own line, brand and form share
 * the next, and "Filters & sort" shows the rest.
 */
export function FilterPanel({ facets, filters, activeCount }: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const moreId = useId();
  const id = useId();

  const select = (
    name: "form" | "area" | "brand",
    label: string,
    allLabel: string,
    options: { key: string; name: string }[],
  ) =>
    options.length > 0 && (
      <div className="min-w-0">
        <label htmlFor={`${id}-${name}`} className="sr-only">
          {label}
        </label>
        <select
          id={`${id}-${name}`}
          name={name}
          defaultValue={filters[name] ?? ""}
          className={control}
        >
          <option value="">{allLabel}</option>
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
    );

  return (
    <form
      // Remount when the URL's filters change (a chip, say), so the
      // uncontrolled fields pick up the new defaults.
      key={[filters.form, filters.area, filters.brand, filters.sort, filters.q].join("|")}
      action="/products"
      method="get"
      aria-label={copy.filters.label}
      className="grid grid-cols-2 gap-2.25 lg:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,11rem))_auto]"
    >
      <div className="col-span-2 flex h-11 min-w-0 items-center gap-2 rounded-md border border-line bg-surface px-3 transition focus-within:border-brand focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand lg:col-span-1">
        <Search aria-hidden className="size-4.5 shrink-0 text-muted" />
        <label htmlFor={`${id}-q`} className="sr-only">
          {copy.filters.searchLabel}
        </label>
        <input
          id={`${id}-q`}
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder={copy.filters.searchPlaceholder}
          className="h-full w-full min-w-0 bg-transparent text-small text-ink outline-none placeholder:text-muted"
        />
      </div>
      {select("brand", copy.filters.brand, copy.filters.allBrands, facets.brands)}
      {select("form", copy.filters.form, copy.filters.allProductForms, facets.forms)}

      <div
        id={moreId}
        className={cn("col-span-2 grid grid-cols-2 gap-2.25 lg:contents", !open && "max-lg:hidden")}
      >
        {select("area", copy.filters.area, copy.filters.allAreas, facets.areas)}
        <div className="min-w-0">
          <label htmlFor={`${id}-sort`} className="sr-only">
            {copy.filters.sort}
          </label>
          <select id={`${id}-sort`} name="sort" defaultValue={filters.sort} className={control}>
            {catalogueSorts.map((sort) => (
              <option key={sort} value={sort}>
                {copy.filters.sort}: {copy.filters.sorts[sort]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={moreId}
        onClick={() => setOpen((value) => !value)}
        className={cn(control, "inline-flex items-center justify-center gap-2 text-ink lg:hidden")}
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        {activeCount > 0 ? copy.filters.toggleCount(activeCount) : copy.filters.toggle}
      </button>
      <button
        type="submit"
        className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-brand px-5 font-heading text-small font-extrabold text-white transition hover:bg-brand-dark"
      >
        {copy.filters.apply}
      </button>
    </form>
  );
}
