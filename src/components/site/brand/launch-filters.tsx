"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { brand } from "@/content/brand";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import { brandSorts, type BrandSort } from "@/lib/brand";
import type { BrandFilterOption, BrandProductFilters } from "@/server/brand/drafts";

const copy = brand.product.filters;

export type LaunchFilterPanelProps = {
  makers: BrandFilterOption[];
  filters: BrandProductFilters & { sort: BrandSort };
  /** Whole rupees, the cheapest and dearest branded price. */
  priceRange: { min: number; max: number };
  activeCount: number;
};

/**
 * More filters for the Launch product catalogue: brand, a branded-price
 * range and the sort (product form and practice area are in the toolbar
 * and the side lists), as a plain GET form so the URL
 * holds them. Always open in the sidebar from 1100 px; a button shows and
 * hides it on smaller screens.
 */
export function LaunchFilterPanel({
  makers,
  filters,
  priceRange,
  activeCount,
}: LaunchFilterPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const id = useId();
  const [low, setLow] = useState(filters.minPrice ?? priceRange.min);
  const [high, setHigh] = useState(filters.maxPrice ?? priceRange.max);
  const hasRange = priceRange.max > priceRange.min;
  const rupees = (n: number) => formatPaise(n * 100);

  const select = (
    name: "form" | "area" | "maker",
    label: string,
    options: BrandFilterOption[],
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
          <option value="">{copy.any}</option>
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
        className={cn(buttonClasses({ variant: "secondary" }), "w-full justify-between lg:hidden")}
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal aria-hidden className="size-4.5" />
          {activeCount > 0 ? copy.toggleCount(activeCount) : copy.toggle}
        </span>
      </button>
      <form
        // Remount when the URL's filters change (a chip, say), so the inputs pick up the new values.
        key={[
          filters.form,
          filters.area,
          filters.maker,
          filters.minPrice,
          filters.maxPrice,
          filters.sort,
          filters.q,
        ].join("|")}
        id={panelId}
        action="/launch"
        method="get"
        aria-label={copy.label}
        className={cn(
          "mt-3 flex flex-col gap-4 rounded-xl border border-line bg-surface p-4.5 shadow-card",
          !open && "max-lg:hidden",
        )}
      >
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        {/* Product form and practice area are chosen in the toolbar and the side lists. */}
        {filters.form && <input type="hidden" name="form" value={filters.form} />}
        {filters.area && <input type="hidden" name="area" value={filters.area} />}
        {select("maker", copy.maker, makers)}
        {hasRange && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-extrabold text-ink">{copy.price}</legend>
            <p aria-live="polite" className="text-sm font-bold text-brand">
              {copy.priceRange(rupees(low), rupees(high))}
            </p>
            <label className="flex flex-col gap-1 text-small text-muted">
              {copy.priceMin}
              <input
                type="range"
                name="minPrice"
                min={priceRange.min}
                max={priceRange.max}
                step={1}
                value={low}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setLow(next);
                  if (next > high) setHigh(next);
                }}
                className="h-11 w-full cursor-pointer accent-brand"
              />
            </label>
            <label className="flex flex-col gap-1 text-small text-muted">
              {copy.priceMax}
              <input
                type="range"
                name="maxPrice"
                min={priceRange.min}
                max={priceRange.max}
                step={1}
                value={high}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setHigh(next);
                  if (next < low) setLow(next);
                }}
                className="h-11 w-full cursor-pointer accent-brand"
              />
            </label>
          </fieldset>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-sort`} className="text-xs font-extrabold text-ink">
            {copy.sort}
          </label>
          <select
            id={`${id}-sort`}
            name="sort"
            defaultValue={filters.sort}
            className={cn(inputClasses, "cursor-pointer")}
          >
            {brandSorts.map((sort) => (
              <option key={sort} value={sort}>
                {copy.sorts[sort]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 *:flex-1">
          <Button type="submit">{copy.apply}</Button>
          {activeCount > 0 && (
            <Link href="/launch" className={buttonClasses({ variant: "secondary" })}>
              {copy.clear}
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
