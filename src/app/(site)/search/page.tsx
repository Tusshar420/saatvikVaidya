import type { Metadata } from "next";
import Link from "next/link";
import { Search, SearchX } from "lucide-react";
import { CataloguePagination } from "@/components/site/catalogue/catalogue-pagination";
import { ProductGrid } from "@/components/site/catalogue/product-card";
import { SampleNote } from "@/components/site/catalogue/sample-note";
import { Button, ButtonArrow, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClasses } from "@/components/ui/field";
import { SectionHeading } from "@/components/ui/section-heading";
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
  const [viewer, popular] = await Promise.all([
    getPricingViewer(),
    getSetting("search.popular"),
  ]);
  const listing = filters.q ? await listCatalogue(filters, viewer) : null;

  return (
    <div className="shell py-8 sm:py-12">
      <SectionHeading as="h1" eyebrow={text.eyebrow} title={text.title} />

      <form
        role="search"
        action="/search"
        method="get"
        aria-label={text.label}
        className="flex max-w-2xl gap-2 max-sm:flex-col"
      >
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
          className={cn(inputClasses, "sm:flex-1")}
        />
        <Button type="submit" icon={<Search aria-hidden className="size-4.5" />}>
          {text.submit}
        </Button>
      </form>

      {!listing && (
        <div className="mt-8">
          <p className="text-body text-muted">{text.prompt}</p>
          {popular.length > 0 && (
            <>
              <h2 className="mt-6 text-xs font-bold tracking-[0.08em] text-muted uppercase">
                {text.popular}
              </h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {popular.map((term) => (
                  <li key={term}>
                    <Link
                      href={`/search?q=${encodeURIComponent(term)}`}
                      className="inline-flex min-h-11 items-center rounded-sm border border-line bg-surface-alt px-3 text-small text-ink transition hover:border-teal hover:text-teal"
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
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="search-results" className="text-base font-extrabold text-ink">
              {copy.listing.resultsFor(listing.total, filters.q)}
            </h2>
            {listing.total > 0 && (
              <Link
                href={catalogueHref({ q: filters.q })}
                className="inline-flex min-h-11 items-center gap-2 text-small font-black text-teal underline-offset-4 hover:underline"
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
  );
}
