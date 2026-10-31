import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import { AssistedOrderBuilder } from "@/components/admin/assisted-order-builder";
import { CustomerSummary } from "@/components/admin/assisted-order-bits";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClasses } from "@/components/ui/field";
import { assistedOrders as copy } from "@/content/assisted-orders";
import { cn } from "@/lib/cn";
import {
  findCustomers,
  listOrderableProducts,
  readCustomer,
} from "@/server/assisted-orders/assisted-orders";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.admin.create.metaTitle };

const text = copy.admin.create;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/**
 * "Prepare an order": find the customer (?q=), choose them (?user=), then
 * add the medicines and a message. Saving sends the customer the link.
 */
export default async function NewAssistedOrderPage({ searchParams }: PageProps<"/admin/assisted-orders/new">) {
  await requireAdmin("orders", "/admin/assisted-orders/new");
  const params = await searchParams;
  const q = first(params.q).trim().slice(0, 100);
  const customer = await readCustomer(first(params.user));
  const [matches, products] = await Promise.all([
    customer ? Promise.resolve([]) : findCustomers(q),
    customer ? listOrderableProducts() : Promise.resolve([]),
  ]);

  return (
    <>
      <Link
        href="/admin/assisted-orders"
        className={buttonClasses({ variant: "link", className: "-ml-1 min-h-11 px-1" })}
      >
        <ChevronLeft aria-hidden className="size-4" />
        {text.back}
      </Link>
      <AdminPageHeader eyebrow={text.eyebrow} title={text.title} className="mt-2" />

      <div className="mt-6 flex max-w-3xl flex-col gap-5">
        {customer ? (
          <Card as="section" aria-labelledby="assisted-customer">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 id="assisted-customer" className="text-h3 text-ink">
                {text.customerTitle}
              </h2>
              <Link href="/admin/assisted-orders/new" className={buttonClasses({ variant: "link", size: "sm" })}>
                {text.change}
              </Link>
            </div>
            <CustomerSummary customer={customer} className="mt-3" />
          </Card>
        ) : (
          <Card as="section" aria-labelledby="assisted-find">
            <h2 id="assisted-find" className="text-h3 text-ink">
              {text.customerStep}
            </h2>
            <p className="mt-1 text-sm text-muted">{text.customerHelp}</p>
            <form method="get" role="search" aria-label={text.searchLabel} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col">
                <label htmlFor="assisted-q" className="mb-1.5 text-xs font-extrabold text-ink">
                  {text.searchLabel}
                </label>
                <span className="relative block">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted"
                  />
                  <input
                    id="assisted-q"
                    type="search"
                    name="q"
                    defaultValue={q}
                    placeholder={text.searchPlaceholder}
                    maxLength={100}
                    autoComplete="off"
                    className={cn(inputClasses, "pl-10")}
                  />
                </span>
              </div>
              <Button type="submit" variant="secondary">
                {text.search}
              </Button>
            </form>

            {q.length > 0 && q.length < 3 && <p className="mt-4 text-sm text-muted">{text.typeMore}</p>}
            {q.length >= 3 && matches.length === 0 && <p className="mt-4 text-sm text-muted">{text.noMatches}</p>}
            {matches.length > 0 && (
              <ul aria-label={text.resultsLabel} className="mt-4 flex flex-col divide-y divide-line rounded-lg border border-line">
                {matches.map((match) => (
                  <li key={match.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                    <CustomerSummary customer={match} compact />
                    <Link
                      href={`/admin/assisted-orders/new?user=${encodeURIComponent(match.id)}`}
                      aria-label={text.chooseLabel(match.name)}
                      className={buttonClasses({ variant: "secondary", size: "sm", className: "max-sm:w-full" })}
                    >
                      {text.choose}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {customer && <AssistedOrderBuilder customerId={customer.id} products={products} />}
      </div>
    </>
  );
}
