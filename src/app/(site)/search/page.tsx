import type { Metadata } from "next";
import Link from "next/link";
import { Search, SearchX } from "lucide-react";
import { CataloguePagination } from "@/components/site/catalogue/catalogue-pagination";
import { ProductGrid } from "@/components/site/catalogue/product-card";
import { SampleNote } from "@/components/site/catalogue/sample-note";
import { PageHero } from "@/components/site/page-hero";
import { ButtonArrow, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { catalogue as copy } from "@/content/catalogue";
import { catalogueHref } from "@/lib/catalogue";
import { cn } from "@/lib/cn";
import {
  catalogueFiltersSchema,
  listCatalogue,
} from "@/server/catalogue/products";
import { getSetting } from "@/server/content/settings";
import { getPricingViewer } from "@/server/pricing";

const text = copy.search;

export async function generateMetadata({
  searchParams,
}: PageProps<"/search">): Promise<Metadata> {
  const { q } = catalogueFiltersSchema.parse(await searchParams);
  return {
    title: q ? text.metaTitleFor(q) : text.metaTitle,
    robots: { index: false },
  };
}

/**
 * Product search. The header's search field (and its phone icon) land here;
 * the page has its own field too, since phones have no header field.
 */
export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const parsed = catalogueFiltersSchema.parse(await searchParams);
  // Search looks across the whole catalogue: only the words and the page count.
  const filters = { ...parsed, form: undefined, area: undefined, brand: undefined, sort: "featured" as const };
  const [viewer, popular, discount] = await Promise.all([
    getPricingViewer(),
    getSetting("search.popular"),
    getSetting("pricing.discount"),
  ]);
  const listing = filters.q ? await listCatalogue(filters, viewer, discount.percent) : null;

  return (
    <>
    <PageHero eyebrow={text.eyebrow} title={text.title} description={text.description} />
    <div className="shell pt-7 pb-24 md:pt-13.5">
      <form
        role="search"
        action="/search"
        method="get"
        aria-label={text.label}
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.25"
      >
        <div className="flex h-11 min-w-0 items-center gap-2 rounded-md border border-line bg-surface px-3 transition focus-within:border-brand focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
          <Search aria-hidden className="size-4.5 shrink-0 text-muted" />
          <label htmlFor="search-q" className="sr-only">
            {text.label}
          </label>
          <input
            id="search-q"
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder={text.placeholder}
            maxLength={100}
            autoComplete="off"
            enterKeyHint="search"
            className="h-full w-full min-w-0 bg-transparent text-small text-ink outline-none placeholder:text-muted"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-5 font-heading text-small font-extrabold text-white transition hover:bg-brand-dark"
        >
          <Search aria-hidden className="size-4 max-sm:hidden" />
          {text.submit}
        </button>
      </form>

      {!listing && (
        <div className="mt-8">
          <p className="text-body text-muted">{text.prompt}</p>
          {popular.length > 0 && (
            <>
              <h2 className="mt-6 font-heading text-label text-brand-mid uppercase">
                {text.popular}
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {popular.map((term) => (
                  <li key={term}>
                    <Link
                      href={`/search?q=${encodeURIComponent(term)}`}
                      className="inline-flex min-h-10 items-center rounded-md border border-line bg-surface px-3.5 text-small font-bold text-ink transition hover:border-brand hover:text-brand"
                    >
                      {term}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link href="/products" className={cn(buttonClasses({ variant: "secondary" }), "mt-8")}>
            {text.browseAll}
            <ButtonArrow />
          </Link>
        </div>
      )}

      {listing && filters.q && (
        <section aria-labelledby="search-results" className="mt-8">
          <div className="mb-5.5 flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
            <h2 id="search-results" className="font-heading text-[24px] leading-[1.1] font-extrabold tracking-[-0.035em] text-ink md:text-[28px]">
              {copy.listing.resultsFor(listing.total, filters.q)}
            </h2>
            {listing.total > 0 && (
              <Link
                href={catalogueHref({ q: filters.q })}
                className="inline-flex min-h-11 items-center gap-2 text-small font-black text-brand underline-offset-4 hover:underline"
              >
                {text.refine}
                <ButtonArrow />
              </Link>
            )}
          </div>
          {listing.products.length > 0 ? (
            <>
              {listing.products.some((product) => product.isSample) && (
                <SampleNote className="mb-4">{copy.sampleNote}</SampleNote>
              )}
              <ProductGrid
                products={listing.products}
                label={copy.listing.resultsFor(listing.total, filters.q)}
              />
              <CataloguePagination
                basePath="/search"
                params={{ q: filters.q }}
                page={listing.page}
                pageCount={listing.pageCount}
              />
            </>
          ) : (
            <EmptyState
              icon={<SearchX aria-hidden />}
              title={text.empty.title(filters.q)}
              description={text.empty.line}
              action={
                <Link href="/products" className={buttonClasses({ variant: "secondary" })}>
                  {text.browseAll}
                </Link>
              }
            />
          )}
        </section>
      )}
    </div>
    </>
  );
}
