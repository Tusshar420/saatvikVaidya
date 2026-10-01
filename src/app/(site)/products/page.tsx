import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch } from "lucide-react";
import {
  ActiveFilters,
  activeFilterCount,
  filterParams,
} from "@/components/site/catalogue/active-filters";
import { CataloguePagination } from "@/components/site/catalogue/catalogue-pagination";
import { FilterPanel } from "@/components/site/catalogue/filter-panel";
import { FormChips } from "@/components/site/catalogue/form-chips";
import { ProductGrid } from "@/components/site/catalogue/product-card";
import { SampleNote } from "@/components/site/catalogue/sample-note";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { catalogue as copy } from "@/content/catalogue";
import {
  catalogueFiltersSchema,
  listCatalogue,
} from "@/server/catalogue/products";
import { getPricingViewer } from "@/server/pricing";

const text = copy.listing;

export const metadata: Metadata = {
  title: text.metaTitle,
  description: text.metaDescription,
};

export default async function ProductsPage({
  searchParams,
}: PageProps<"/products">) {
  const [params, viewer] = await Promise.all([searchParams, getPricingViewer()]);
  const listing = await listCatalogue(catalogueFiltersSchema.parse(params), viewer);
  const { filters, facets, products, total } = listing;
  const resultsLabel = filters.q
    ? text.resultsFor(total, filters.q)
    : text.results(total);

  return (
    <div className="shell py-8 sm:py-12">
      <SectionHeading
        as="h1"
        eyebrow={text.eyebrow}
        title={text.title}
        emphasis={text.titleEmphasis}
        description={text.description}
      />
      <FormChips forms={facets.forms} filters={filters} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <aside className="lg:sticky lg:top-40 lg:self-start">
          <FilterPanel
            facets={facets}
            filters={filters}
            activeCount={activeFilterCount(filters)}
          />
        </aside>

        <section aria-labelledby="catalogue-results" className="min-w-0">
          <div className="mb-4 flex flex-col gap-3">
            <h2
              id="catalogue-results"
              aria-live="polite"
              className="text-base font-extrabold text-ink"
            >
              {resultsLabel}
            </h2>
            <ActiveFilters filters={filters} facets={facets} />
          </div>

          {products.length > 0 ? (
            <>
              {products.some((product) => product.isSample) && (
                <SampleNote className="mb-4">{copy.sampleNote}</SampleNote>
              )}
              <ProductGrid products={products} label={resultsLabel} />
              <CataloguePagination
                basePath="/products"
                params={filterParams(filters)}
                page={listing.page}
                pageCount={listing.pageCount}
              />
            </>
          ) : (
            <EmptyState
              icon={<PackageSearch aria-hidden />}
              title={text.empty.title}
              description={text.empty.line}
              action={
                <Link href="/products" className={buttonClasses({ variant: "secondary" })}>
                  {text.empty.action}
                </Link>
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}
