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
import { OrderListButton } from "@/components/site/catalogue/order-list-button";
import { SampleNote } from "@/components/site/catalogue/sample-note";
import { PageHero } from "@/components/site/page-hero";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { catalogue as copy } from "@/content/catalogue";
import { cartCount } from "@/server/cart/cart";
import { currentCartOwner } from "@/server/cart/request";
import {
  catalogueFiltersSchema,
  listCatalogue,
} from "@/server/catalogue/products";
import { getSetting } from "@/server/content/settings";
import { getPricingViewer } from "@/server/pricing";

const text = copy.listing;

export const metadata: Metadata = {
  title: text.metaTitle,
  description: text.metaDescription,
};

export default async function ProductsPage({
  searchParams,
}: PageProps<"/products">) {
  const [params, viewer, discount, inCart] = await Promise.all([
    searchParams,
    getPricingViewer(),
    getSetting("pricing.discount"),
    currentCartOwner().then(cartCount),
  ]);
  const listing = await listCatalogue(catalogueFiltersSchema.parse(params), viewer, discount.percent);
  const { filters, facets, products, total } = listing;
  const resultsLabel = filters.q
    ? text.resultsFor(total, filters.q)
    : text.results(total);

  return (
    <>
      <PageHero
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
        note={text.note}
      />
      <div className="shell pt-7 pb-24 md:pt-13.5 md:pb-24">
        <FilterPanel
          facets={facets}
          filters={filters}
          activeCount={activeFilterCount(filters)}
        />

        <section aria-labelledby="catalogue-results" className="mt-5 min-w-0">
          <div className="mb-5.5 flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
            <div className="min-w-0">
              <h2 id="catalogue-results" className="font-heading text-[24px] leading-[1.1] font-extrabold tracking-[-0.035em] text-ink md:text-[28px]">
                {text.sectionTitle}
              </h2>
              <p className="mt-1.5 text-small text-muted">
                {text.sectionLine}{" "}
                <span aria-live="polite" className="font-bold text-ink">
                  {resultsLabel}
                </span>
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-sm bg-success-soft px-2.5 py-1.5 font-heading text-[11px] leading-none font-extrabold tracking-[0.04em] text-success uppercase">
              {text.livePill}
            </span>
          </div>

          <div className="mb-5 flex flex-col gap-3">
            <FormChips forms={facets.forms} filters={filters} pills />
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
      <OrderListButton count={inCart} />
    </>
  );
}
