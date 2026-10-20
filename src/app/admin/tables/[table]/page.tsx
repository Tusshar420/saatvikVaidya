import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TableViewer } from "@/components/admin/table-viewer";
import { Card } from "@/components/ui/card";
import { admin as copy } from "@/content/admin";
import {
  getTableData,
  getTableInfo,
  isHiddenColumn,
  isTableName,
} from "@/server/admin/schema";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.database.metaTitle };

export default async function TableDetailPage({
  params,
}: PageProps<"/admin/tables/[table]">) {
  await requireAdmin("database");
  const { table } = await params;
  // Only names that exist in the database reach the raw queries.
  if (!(await isTableName(table))) notFound();

  const [info, rows] = await Promise.all([
    getTableInfo(table),
    getTableData(table, 50, 0),
  ]);

  return (
    <>
      <Link
        href="/admin/database"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {copy.database.back}
      </Link>
      <AdminPageHeader
        className="mt-2"
        eyebrow={copy.database.eyebrow}
        title={table}
        description={copy.database.rows(info.rowCount)}
      />

      <Card as="section" aria-labelledby="table-columns" className="mt-6">
        <h2 id="table-columns" className="text-h3 text-ink">
          {copy.database.columnsTitle}
        </h2>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-small sm:grid-cols-2">
          {info.columns.map((col) => (
            <div key={col.name} className="flex flex-col">
              <dt className="font-mono font-bold break-all text-ink">
                {col.name}
                {isHiddenColumn(table, col.name) && (
                  <span className="ml-2 font-sans text-xs text-muted">
                    {copy.database.hidden}
                  </span>
                )}
              </dt>
              <dd className="text-muted">
                {copy.database.columnMeta(
                  col.type,
                  Boolean(col.isPrimary),
                  Boolean(col.nullable),
                )}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <section aria-labelledby="table-data" className="mt-6">
        <h2 id="table-data" className="mb-3 text-h3 text-ink">
          {copy.database.dataTitle}
        </h2>
        <TableViewer
          tableName={table}
          columns={info.columns}
          initialData={rows}
          totalRows={info.rowCount}
        />
      </section>
    </>
  );
}
