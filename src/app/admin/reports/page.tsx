import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import {
  DataTable,
  EmptyRow,
  TBody,
  THead,
  Td,
  Th,
  Tr,
} from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { OrderStatusBadge } from "@/components/site/orders/order-status-badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClasses } from "@/components/ui/field";
import { courses as coursesCopy } from "@/content/courses";
import { admin as copy } from "@/content/admin";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber, formatPaise } from "@/lib/format";
import {
  groupings,
  readReports,
  reportFiltersSchema,
  resolveRange,
  type Grouping,
  type SalesBucket,
} from "@/server/admin/reports";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.reports.metaTitle };

const text = copy.reports;

/** "2026-10-01" as "1 Oct 2026"; "2026-10" as "Oct 2026". */
function bucketLabel(key: string, by: Grouping): string {
  if (by === "month") return formatDate(new Date(`${key}-01T12:00:00+05:30`)).replace(/^1 /, "");
  return formatDate(new Date(`${key}T12:00:00+05:30`));
}

/** Sales, orders, products, new users, approvals and coins for a period. */
export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireAdmin("reports");
  const filters = reportFiltersSchema.parse(await searchParams);
  const range = resolveRange(filters);
  const reports = await readReports(range);
  const { sales } = reports;
  const exportQuery = new URLSearchParams({ from: range.from, to: range.to }).toString();
  const peak = Math.max(1, ...sales.buckets.map((bucket) => bucket.paise));

  return (
    <>
      <AdminPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} />

      <form
        method="get"
        role="search"
        aria-label={text.filterLabel}
        className="mt-6 grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <div className="flex flex-col">
          <label htmlFor="report-from" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.from}
          </label>
          <input id="report-from" type="date" name="from" defaultValue={range.from} className={inputClasses} />
        </div>
        <div className="flex flex-col">
          <label htmlFor="report-to" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.to}
          </label>
          <input id="report-to" type="date" name="to" defaultValue={range.to} className={inputClasses} />
        </div>
        <div className="flex flex-col sm:col-span-2 lg:col-span-1">
          <label htmlFor="report-by" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.by}
          </label>
          <select id="report-by" name="by" defaultValue={range.by} className={cn(inputClasses, "cursor-pointer")}>
            {groupings.map((by) => (
              <option key={by} value={by}>
                {text.groupings[by]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
            {text.apply}
          </Button>
          <Link href="/admin/reports" className={buttonClasses({ variant: "link" })}>
            {text.reset}
          </Link>
        </div>
      </form>
      <p className="mt-3 text-small text-muted">
        {text.range(formatDate(new Date(`${range.from}T12:00:00+05:30`)), formatDate(new Date(`${range.to}T12:00:00+05:30`)))}
      </p>

      <section aria-labelledby="report-sales" className="mt-6">
        <h2 id="report-sales" className="text-h3 text-ink">
          {text.sales.title}
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Figure label={text.sales.total} value={formatPaise(sales.totalPaise)} />
          <Figure label={text.sales.orders} value={formatNumber(sales.totalOrders)} />
          <Figure
            label={text.sales.average}
            value={formatPaise(sales.totalOrders ? Math.round(sales.totalPaise / sales.totalOrders) : 0)}
          />
        </ul>
        <DataTable caption={text.sales.title} className="mt-3">
          <THead>
            <Th>{text.sales.period[range.by]}</Th>
            <Th>{text.sales.columns.orders}</Th>
            <Th>{text.sales.columns.amount}</Th>
          </THead>
          <TBody>
            {sales.totalOrders === 0 && <EmptyRow colSpan={3}>{text.sales.empty}</EmptyRow>}
            {sales.totalOrders > 0 &&
              sales.buckets.map((bucket) => (
                <SalesRow key={bucket.key} bucket={bucket} by={range.by} peak={peak} />
              ))}
          </TBody>
        </DataTable>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="report-status">
          <h2 id="report-status" className="text-h3 text-ink">
            {text.status.title}
          </h2>
          <p className="mt-1 text-small text-muted">{text.status.note}</p>
          <DataTable caption={text.status.title} className="mt-3">
            <THead>
              <Th>{text.status.columns.status}</Th>
              <Th>{text.status.columns.count}</Th>
            </THead>
            <TBody>
              {reports.ordersByStatus.map((row) => (
                <Tr key={row.status}>
                  <Td label={text.status.columns.status}>
                    <OrderStatusBadge status={row.status} labels={copy.orders.statuses} />
                  </Td>
                  <Td label={text.status.columns.count}>{formatNumber(row.count)}</Td>
                </Tr>
              ))}
            </TBody>
          </DataTable>
        </section>

        <section aria-labelledby="report-users">
          <h2 id="report-users" className="text-h3 text-ink">
            {text.users.title}
          </h2>
          <p className="mt-1 text-small text-muted">{text.users.total(reports.newUsers.total)}</p>
          <DataTable caption={text.users.title} className="mt-3">
            <THead>
              <Th>{text.users.columns.type}</Th>
              <Th>{text.users.columns.count}</Th>
            </THead>
            <TBody>
              {reports.newUsers.byType.map((row) => (
                <Tr key={row.key}>
                  <Td label={text.users.columns.type}>{row.label}</Td>
                  <Td label={text.users.columns.count}>{formatNumber(row.count)}</Td>
                </Tr>
              ))}
            </TBody>
          </DataTable>
        </section>
      </div>

      <section aria-labelledby="report-top" className="mt-8">
        <h2 id="report-top" className="text-h3 text-ink">
          {text.top.title}
        </h2>
        <p className="mt-1 text-small text-muted">{text.top.note}</p>
        <DataTable caption={text.top.title} className="mt-3">
          <THead>
            <Th>{text.top.columns.product}</Th>
            <Th>{text.top.columns.units}</Th>
            <Th>{text.top.columns.amount}</Th>
          </THead>
          <TBody>
            {reports.topProducts.length === 0 && <EmptyRow colSpan={3}>{text.top.empty}</EmptyRow>}
            {reports.topProducts.map((product) => (
              <Tr key={`${product.kind}-${product.slug}-${product.name}`}>
                <Td label={text.top.columns.product}>
                  <span className="font-semibold break-words text-ink">{product.name}</span>
                  {product.kind === "ebook" && (
                    <span className="block text-small text-muted">{text.top.ebook}</span>
                  )}
                  {product.kind === "course" && (
                    <span className="block text-small text-muted">{coursesCopy.cartLine.kind}</span>
                  )}
                </Td>
                <Td label={text.top.columns.units}>{formatNumber(product.units)}</Td>
                <Td label={text.top.columns.amount} className="whitespace-nowrap">
                  {formatPaise(product.paise)}
                </Td>
              </Tr>
            ))}
          </TBody>
        </DataTable>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="report-coins">
          <h2 id="report-coins" className="text-h3 text-ink">
            {text.coins.title}
          </h2>
          <p className="mt-1 text-small text-muted">{text.coins.note}</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <Figure label={text.coins.issued} value={formatNumber(reports.coins.issued)} help={text.coins.issuedHelp} />
            <Figure
              label={text.coins.redeemed}
              value={formatNumber(reports.coins.redeemed)}
              help={text.coins.redeemedHelp}
            />
            <Figure
              label={text.coins.takenBack}
              value={formatNumber(reports.coins.takenBack)}
              help={text.coins.takenBackHelp}
            />
          </ul>
        </section>

        <section aria-labelledby="report-approvals">
          <h2 id="report-approvals" className="text-h3 text-ink">
            {text.approvals.title}
          </h2>
          <p className="mt-1 text-small text-muted">{text.approvals.note}</p>
          <Card as="div" className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-3xl font-extrabold text-ink">{formatNumber(reports.pendingApprovals)}</p>
            <Link href="/admin/approvals" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              {text.approvals.review}
            </Link>
          </Card>
        </section>
      </div>

      <section aria-labelledby="report-export" className="mt-8">
        <h2 id="report-export" className="text-h3 text-ink">
          {text.export.title}
        </h2>
        <p className="mt-1 max-w-2xl text-small text-muted">{text.export.note}</p>
        <div className="mt-3 flex flex-wrap gap-3 max-sm:*:w-full">
          {/* Plain links: the browser downloads the file. */}
          <a
            href={`/admin/reports/export/orders?${exportQuery}`}
            download
            className={buttonClasses({ variant: "secondary" })}
          >
            <Download aria-hidden className="size-4" />
            {text.export.orders}
          </a>
          <a
            href={`/admin/reports/export/users?${exportQuery}`}
            download
            className={buttonClasses({ variant: "secondary" })}
          >
            <Download aria-hidden className="size-4" />
            {text.export.users}
          </a>
        </div>
      </section>
    </>
  );
}

function Figure({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <li className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <p className="text-small font-bold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
      {help && <p className="mt-1 text-small text-muted">{help}</p>}
    </li>
  );
}

function SalesRow({ bucket, by, peak }: { bucket: SalesBucket; by: Grouping; peak: number }) {
  return (
    <Tr>
      <Td label={text.sales.period[by]} className="whitespace-nowrap">
        {bucketLabel(bucket.key, by)}
      </Td>
      <Td label={text.sales.columns.orders}>{formatNumber(bucket.orders)}</Td>
      <Td label={text.sales.columns.amount}>
        <span className="flex items-center gap-3">
          <span className="whitespace-nowrap">{formatPaise(bucket.paise)}</span>
          <span aria-hidden className="hidden h-2 min-w-0 flex-1 rounded-full bg-surface-alt md:block">
            <span
              className="block h-2 rounded-full bg-brand"
              style={{ width: `${Math.round((bucket.paise / peak) * 100)}%` }}
            />
          </span>
        </span>
      </Td>
    </Tr>
  );
}
