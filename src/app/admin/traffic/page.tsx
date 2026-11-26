import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, EmptyRow, TBody, THead, Td, Th, Tr } from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { traffic as text } from "@/content/traffic";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber } from "@/lib/format";
import { groupings, reportFiltersSchema, resolveRange, type Grouping } from "@/server/admin/reports";
import { readTraffic, type Count } from "@/server/analytics/page-views";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: text.metaTitle };

const istNoon = (day: string) => new Date(`${day}T12:00:00+05:30`);

/** "2026-10-01" as "1 Oct 2026"; "2026-10" as "Oct 2026". */
function bucketLabel(key: string, by: Grouping): string {
  if (by === "month") return formatDate(istNoon(`${key}-01`)).replace(/^1 /, "");
  return formatDate(istNoon(key));
}

const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "0%");

/** Page views on the public site: modules, top pages, account types and devices. */
export default async function AdminTrafficPage({ searchParams }: PageProps<"/admin/traffic">) {
  await requireAdmin("reports");
  const range = resolveRange(reportFiltersSchema.parse(await searchParams));
  const report = await readTraffic(range);
  const { total } = report;
  const empty = total.views === 0;
  const peak = Math.max(1, ...report.buckets.map((bucket) => bucket.views));
  const sectionPeak = Math.max(1, ...report.sections.map((row) => row.views));

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
          <label htmlFor="traffic-from" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.from}
          </label>
          <input id="traffic-from" type="date" name="from" defaultValue={range.from} className={inputClasses} />
        </div>
        <div className="flex flex-col">
          <label htmlFor="traffic-to" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.to}
          </label>
          <input id="traffic-to" type="date" name="to" defaultValue={range.to} className={inputClasses} />
        </div>
        <div className="flex flex-col sm:col-span-2 lg:col-span-1">
          <label htmlFor="traffic-by" className="mb-1.5 text-xs font-extrabold text-ink">
            {text.by}
          </label>
          <select id="traffic-by" name="by" defaultValue={range.by} className={cn(inputClasses, "cursor-pointer")}>
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
          <Link href="/admin/traffic" className={buttonClasses({ variant: "link" })}>
            {text.reset}
          </Link>
        </div>
      </form>
      <p className="mt-3 text-small text-muted">
        {text.range(formatDate(istNoon(range.from)), formatDate(istNoon(range.to)))}
      </p>

      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={text.title}>
        <Figure label={text.figures.views} value={formatNumber(total.views)} help={text.figures.viewsHelp} />
        <Figure label={text.figures.visitors} value={formatNumber(total.visitors)} help={text.figures.visitorsHelp} />
        <Figure
          label={text.figures.perVisitor}
          value={total.visitors ? (total.views / total.visitors).toFixed(1) : "0"}
        />
        <Figure
          label={text.figures.signedIn}
          value={formatNumber(report.signedInViews)}
          help={text.figures.signedInHelp(percent(report.signedInViews, total.views))}
        />
      </ul>

      <section aria-labelledby="traffic-sections" className="mt-8">
        <h2 id="traffic-sections" className="text-h3 text-ink">
          {text.sections.title}
        </h2>
        <p className="mt-1 text-small text-muted">{text.sections.note}</p>
        <DataTable caption={text.sections.title} className="mt-3">
          <THead>
            <Th>{text.sections.module}</Th>
            <Th>{text.columns.views}</Th>
            <Th>{text.columns.visitors}</Th>
            <Th>{text.columns.share}</Th>
          </THead>
          <TBody>
            {empty && <EmptyRow colSpan={4}>{text.empty}</EmptyRow>}
            {report.sections.map((row) => (
              <Tr key={row.key}>
                <Td label={text.sections.module}>
                  <span className="font-semibold text-ink">{text.sectionNames[row.key] ?? row.key}</span>
                </Td>
                <Td label={text.columns.views}>{formatNumber(row.views)}</Td>
                <Td label={text.columns.visitors}>{formatNumber(row.visitors)}</Td>
                <Td label={text.columns.share}>
                  <Bar value={row.views} peak={sectionPeak} label={percent(row.views, total.views)} />
                </Td>
              </Tr>
            ))}
          </TBody>
        </DataTable>
      </section>

      <section aria-labelledby="traffic-pages" className="mt-8">
        <h2 id="traffic-pages" className="text-h3 text-ink">
          {text.pages.title}
        </h2>
        <p className="mt-1 text-small text-muted">{text.pages.note}</p>
        <DataTable caption={text.pages.title} className="mt-3">
          <THead>
            <Th>{text.pages.page}</Th>
            <Th>{text.sections.module}</Th>
            <Th>{text.columns.views}</Th>
            <Th>{text.columns.visitors}</Th>
          </THead>
          <TBody>
            {empty && <EmptyRow colSpan={4}>{text.empty}</EmptyRow>}
            {report.pages.map((row) => (
              <Tr key={row.key}>
                <Td label={text.pages.page}>
                  <span className="font-semibold break-all text-ink">{row.key}</span>
                </Td>
                <Td label={text.sections.module}>{row.section ? text.sectionNames[row.section] : "-"}</Td>
                <Td label={text.columns.views}>{formatNumber(row.views)}</Td>
                <Td label={text.columns.visitors}>{formatNumber(row.visitors)}</Td>
              </Tr>
            ))}
          </TBody>
        </DataTable>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <CountTable
          id="traffic-audiences"
          title={text.audiences.title}
          note={text.audiences.note}
          column={text.audiences.type}
          total={total.views}
          rows={report.audiences.map((row) => ({
            key: row.key,
            name: row.key === "guest" ? text.audiences.guest : (row.label ?? text.audiences.unknown),
            views: row.views,
            visitors: row.visitors,
          }))}
        />
        <CountTable
          id="traffic-devices"
          title={text.devices.title}
          column={text.devices.device}
          total={total.views}
          rows={report.devices.map((row) => ({
            key: row.key,
            name: text.devices.names[row.key] ?? row.key,
            views: row.views,
            visitors: row.visitors,
          }))}
        />
      </div>

      <section aria-labelledby="traffic-trend" className="mt-8">
        <h2 id="traffic-trend" className="text-h3 text-ink">
          {text.trend.title}
        </h2>
        <DataTable caption={text.trend.title} className="mt-3">
          <THead>
            <Th>{text.trend.period[range.by]}</Th>
            <Th>{text.columns.visitors}</Th>
            <Th>{text.columns.views}</Th>
          </THead>
          <TBody>
            {empty && <EmptyRow colSpan={3}>{text.empty}</EmptyRow>}
            {!empty &&
              report.buckets.map((bucket) => (
                <Tr key={bucket.key}>
                  <Td label={text.trend.period[range.by]} className="whitespace-nowrap">
                    {bucketLabel(bucket.key, range.by)}
                  </Td>
                  <Td label={text.columns.visitors}>{formatNumber(bucket.visitors)}</Td>
                  <Td label={text.columns.views}>
                    <Bar value={bucket.views} peak={peak} label={formatNumber(bucket.views)} />
                  </Td>
                </Tr>
              ))}
          </TBody>
        </DataTable>
      </section>

      <p className="mt-8 max-w-3xl text-small text-muted">{text.privacyNote}</p>
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

function Bar({ value, peak, label }: { value: number; peak: number; label: string }) {
  return (
    <span className="flex items-center gap-3">
      <span className="min-w-10 whitespace-nowrap">{label}</span>
      <span aria-hidden className="hidden h-2 min-w-0 flex-1 rounded-full bg-surface-alt md:block">
        <span className="block h-2 rounded-full bg-brand" style={{ width: `${Math.round((value / peak) * 100)}%` }} />
      </span>
    </span>
  );
}

function CountTable({
  id,
  title,
  note,
  column,
  total,
  rows,
}: {
  id: string;
  title: string;
  note?: string;
  column: string;
  total: number;
  rows: (Count & { key: string; name: string })[];
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-h3 text-ink">
        {title}
      </h2>
      {note && <p className="mt-1 text-small text-muted">{note}</p>}
      <DataTable caption={title} className="mt-3">
        <THead>
          <Th>{column}</Th>
          <Th>{text.columns.views}</Th>
          <Th>{text.columns.visitors}</Th>
          <Th>{text.columns.share}</Th>
        </THead>
        <TBody>
          {rows.length === 0 && <EmptyRow colSpan={4}>{text.empty}</EmptyRow>}
          {rows.map((row) => (
            <Tr key={row.key}>
              <Td label={column}>{row.name}</Td>
              <Td label={text.columns.views}>{formatNumber(row.views)}</Td>
              <Td label={text.columns.visitors}>{formatNumber(row.visitors)}</Td>
              <Td label={text.columns.share}>{percent(row.views, total)}</Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
    </section>
  );
}
