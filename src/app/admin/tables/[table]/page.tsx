import { getTableInfo, getTableData, getTableNames } from "@/server/admin/schema";
import { TableViewer } from "@/components/admin/table-viewer";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Table · Admin Panel · Saatvik Vaidya",
};

export async function generateStaticParams() {
  try {
    const tableNames = await getTableNames();
    return tableNames.map((name) => ({
      table: name,
    }));
  } catch {
    return [];
  }
}

export default async function TableDetailPage({
  params,
}: {
  params: Promise<{ table: string }>;
}) {
  const { table: tableName } = await params;

  // Validate table name to prevent injection
  const validTables = await getTableNames();
  if (!validTables.includes(tableName)) {
    notFound();
  }

  const tableInfo = await getTableInfo(tableName);
  const data = await getTableData(tableName, 50, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-teal hover:text-teal-dark"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to tables
        </Link>
      </div>

      <div>
        <h1 className="text-h2 mb-2">{tableName}</h1>
        <p className="text-body text-muted">
          {tableInfo.rowCount.toLocaleString()} row
          {tableInfo.rowCount !== 1 ? "s" : ""} • {tableInfo.columns.length}{" "}
          column{tableInfo.columns.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid gap-2 p-4 bg-soft rounded-lg">
        <h2 className="font-semibold text-body mb-2">Columns</h2>
        <div className="grid gap-2">
          {tableInfo.columns.map((col) => (
            <div key={col.name} className="flex items-start gap-4 text-small">
              <span className="font-mono font-semibold text-dark w-40 flex-shrink-0">
                {col.name}
              </span>
              <span className="text-muted">
                {col.type}
                {col.isPrimary && " • Primary Key"}
                {!col.nullable && " • NOT NULL"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-body mb-4">Data</h2>
        <TableViewer
          tableName={tableName}
          columns={tableInfo.columns}
          initialData={data}
          totalRows={tableInfo.rowCount}
        />
      </div>
    </div>
  );
}
