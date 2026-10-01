"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
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

/**
 * Filter and sort form (a plain GET form, so the URL holds the filters).
 * From 1100 px it's always open in the sidebar; on smaller screens a
 * "Filters & sort" button shows and hides it.
 */
export function FilterPanel({ facets, filters, activeCount }: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const id = useId();

  const select = (
    name: "form" | "area" | "brand",
    label: string,
    options: { key: string; name: string }[],
  ) =>
    options.length > 0 && (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-${name}`} className="text-xs font-extrabold text-ink">
          {label}
        </label>
        <select
          id={`${id}-${name}`}
          name={name}
          defaultValue={filters[name] ?? ""}
          className={cn(inputClasses, "cursor-pointer")}
        >
          <option value="">{copy.filters.any}</option>
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
    );

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          buttonClasses({ variant: "secondary" }),
          "w-full justify-between lg:hidden",
        )}
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal aria-hidden className="size-4.5" />
          {activeCount > 0 ? copy.filters.toggleCount(activeCount) : copy.filters.toggle}
        </span>
      </button>
      <form
        // Remount when the URL's filters change (a chip, say), so the
        // uncontrolled selects pick up the new defaults.
        key={[filters.form, filters.area, filters.brand, filters.sort, filters.q].join("|")}
        id={panelId}
        action="/products"
        method="get"
        aria-label={copy.filters.label}
        className={cn(
          "mt-3 flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-card lg:mt-0 lg:p-5",
          !open && "max-lg:hidden",
        )}
      >
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        {select("form", copy.filters.form, facets.forms)}
        {select("area", copy.filters.area, facets.areas)}
        {select("brand", copy.filters.brand, facets.brands)}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-sort`} className="text-xs font-extrabold text-ink">
            {copy.filters.sort}
          </label>
          <select
            id={`${id}-sort`}
            name="sort"
            defaultValue={filters.sort}
            className={cn(inputClasses, "cursor-pointer")}
          >
            {catalogueSorts.map((sort) => (
              <option key={sort} value={sort}>
                {copy.filters.sorts[sort]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 *:flex-1">
          <Button type="submit">{copy.filters.apply}</Button>
          {activeCount > 0 && (
            <Link href="/products" className={buttonClasses({ variant: "secondary" })}>
              {copy.filters.clear}
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
