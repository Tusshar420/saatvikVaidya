import Link from "next/link";
import { catalogue as copy } from "@/content/catalogue";
import { catalogueHref } from "@/lib/catalogue";
import { cn } from "@/lib/cn";
import type { CatalogueFilters, FacetOption } from "@/server/catalogue/products";
import { filterParams } from "./active-filters";

/**
 * Quick links by product form, as the mockup's filter row: one line that
 * scrolls sideways on phones. Other filters are kept.
 */
export function FormChips({
  forms,
  filters,
  hrefFor,
  allLabel = copy.filters.allForms,
  label = copy.filters.formsLabel,
}: {
  forms: FacetOption[];
  filters: { form?: string };
  /** Link for a form (or all forms); the store listing by default. */
  hrefFor?: (form: string | undefined) => string;
  allLabel?: string;
  label?: string;
}) {
  if (forms.length === 0) return null;
  const storeParams = hrefFor ? null : filterParams(filters as CatalogueFilters);
  const chip = (key: string | undefined, label: string) => {
    const current = filters.form === key;
    return (
      <li key={key ?? "all"} className="shrink-0">
        <Link
          href={hrefFor ? hrefFor(key) : catalogueHref({ ...storeParams, form: key })}
          aria-current={current ? "true" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center rounded-sm border px-3.5 text-sm font-semibold whitespace-nowrap transition",
            current
              ? "border-teal bg-teal-soft font-extrabold text-teal"
              : "border-line bg-surface text-ink hover:border-teal/60",
          )}
        >
          {label}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label={label}>
      <ul className="-mx-1 flex scrollbar-none gap-2 overflow-x-auto px-1 py-1">
        {chip(undefined, allLabel)}
        {forms.map((form) => chip(form.key, form.name))}
      </ul>
    </nav>
  );
}
