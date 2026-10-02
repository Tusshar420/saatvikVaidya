import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus, Search } from "lucide-react";
import { ActiveBadge } from "@/components/admin/badges";
import {
  DataTable,
  EmptyRow,
  TBody,
  THead,
  Td,
  Th,
  Tr,
} from "@/components/admin/data-table";
import { Notice, parseNotice } from "@/components/admin/notice";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { admin as copy } from "@/content/admin";
import { productImageSrc } from "@/lib/catalogue";
import { cn } from "@/lib/cn";
import { formatNumber, formatPaise } from "@/lib/format";
import {
  listAdminProducts,
  productFiltersSchema,
} from "@/server/admin/catalogue";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.catalogue.metaTitle };

const text = copy.catalogue;

export default async function CataloguePage({
  searchParams,
}: PageProps<"/admin/catalogue">) {
  await requireAdmin("catalogue");
  const params = await searchParams;
  const filters = productFiltersSchema.parse(params);
  const { products, total, page, pageCount } = await listAdminProducts(filters);
  const filtered = Boolean(filters.q || filters.status);

  return (
    <>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
        action={
          <Link href="/admin/catalogue/new" className={buttonClasses()}>
            <Plus aria-hidden className="size-4.5" />
            {text.add}
          </Link>
        }
      />
      <Notice notice={parseNotice(params.notice)} />

      <form
        method="get"
        role="search"
        aria-label={text.searchLabel}
        className="mt-6 grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-[2fr_1fr_auto]"
      >
        <div className="flex flex-col">
          <label htmlFor="filter-q" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.searchLabel}
          </label>
          <span className="relative block">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted"
            />
            <input
              id="filter-q"
              type="search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder={text.searchPlaceholder}
              maxLength={100}
              className={cn(inputClasses, "pl-10")}
            />
          </span>
        </div>
        <div className="flex flex-col">
          <label htmlFor="filter-status" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.statusFilter}
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={filters.status ?? ""}
            className={cn(inputClasses, "cursor-pointer")}
          >
            <option value="">{copy.common.all}</option>
            <option value="active">{text.statuses.active}</option>
            <option value="hidden">{text.statuses.hidden}</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
            {copy.common.filter}
          </Button>
          {filtered && (
            <Link href="/admin/catalogue" className={buttonClasses({ variant: "link" })}>
              {copy.common.clearFilters}
            </Link>
          )}
        </div>
      </form>

      <p className="mt-4 text-small text-muted">{text.count(total)}</p>
      <DataTable caption={text.title} className="mt-3">
        <THead>
          <Th className="w-16">{text.columns.image}</Th>
          <Th>{text.columns.name}</Th>
          <Th>{text.columns.brand}</Th>
          <Th>{text.columns.prices}</Th>
          <Th>{text.columns.stock}</Th>
          <Th>{text.columns.status}</Th>
          <Th>
            <span className="sr-only">{text.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {products.length === 0 && (
            <EmptyRow colSpan={7}>{filtered ? copy.common.noResults : text.empty}</EmptyRow>
          )}
          {products.map((product) => (
            <Tr key={product.id}>
              <Td label={text.columns.image}>
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- our own image route
                  <img
                    src={productImageSrc(product.images[0].id)}
                    alt=""
                    className="size-10 rounded-md border border-line bg-surface-alt object-contain"
                  />
                ) : (
                  <span aria-hidden className="block size-10 rounded-md bg-teal-soft" />
                )}
              </Td>
              <Td>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ink">{product.name}</span>
                  {product.featured && <Badge variant="gold">{text.featured}</Badge>}
                  {product.isSample && <Badge variant="soon">{text.sample}</Badge>}
                </span>
                <code className="block text-small text-muted">{product.slug}</code>
              </Td>
              <Td label={text.columns.brand}>{product.brand?.name ?? text.noBrand}</Td>
              <Td label={text.columns.prices} className="whitespace-nowrap">
                {formatPaise(product.mrpPaise)} / {formatPaise(product.professionalPricePaise)}
              </Td>
              <Td label={text.columns.stock}>{formatNumber(product.stock)}</Td>
              <Td label={text.columns.status}>
                <ActiveBadge active={product.active} />
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2 max-md:mt-2 max-md:*:flex-1 md:justify-end">
                  <Link
                    href={`/admin/catalogue/${product.id}/edit`}
                    aria-label={`${copy.common.edit} ${product.name}`}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    <Pencil aria-hidden className="size-4" />
                    {copy.common.edit}
                  </Link>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
      <Pagination
        basePath="/admin/catalogue"
        params={{ q: filters.q, status: filters.status }}
        page={page}
        pageCount={pageCount}
      />
    </>
  );
}
