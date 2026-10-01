import Link from "next/link";
import { X } from "lucide-react";
import { catalogue as copy } from "@/content/catalogue";
import { catalogueHref } from "@/lib/catalogue";
import type { CatalogueFacets, CatalogueFilters } from "@/server/catalogue/products";

type FilterName = "q" | "form" | "area" | "brand";

/** The filters' URL values (page dropped, default sort left out). */
export function filterParams(filters: CatalogueFilters) {
  return {
    q: filters.q,
    form: filters.form,
    area: filters.area,
    brand: filters.brand,
    sort: filters.sort === "featured" ? undefined : filters.sort,
  };
}

/** How many of search, form, area and brand are set. */
export function activeFilterCount(filters: CatalogueFilters): number {
  return (["q", "form", "area", "brand"] as const).filter((name) => filters[name])
    .length;
}

/** A removable chip per filter in use; each link drops that one filter. */
export function ActiveFilters({
  filters,
  facets,
}: {
  filters: CatalogueFilters;
  facets: CatalogueFacets;
}) {
  const nameOf = (options: { key: string; name: string }[], key?: string) =>
    options.find((option) => option.key === key)?.name;
  const chips = (
    [
      ["q", filters.q && copy.filters.search(filters.q)],
      ["form", nameOf(facets.forms, filters.form)],
      ["area", nameOf(facets.areas, filters.area)],
      ["brand", nameOf(facets.brands, filters.brand)],
    ] as [FilterName, string | undefined][]
  ).filter((chip): chip is [FilterName, string] => Boolean(chip[1]));
  if (chips.length === 0) return null;

  const params = filterParams(filters);
  return (
    <ul aria-label={copy.filters.active} className="flex flex-wrap gap-2">
      {chips.map(([name, label]) => (
        <li key={name}>
          <Link
            href={catalogueHref({ ...params, [name]: undefined })}
            aria-label={copy.filters.remove(label)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-teal bg-teal-soft px-3 text-sm font-bold text-teal transition hover:bg-surface"
          >
            {label}
            <X aria-hidden className="size-4" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
