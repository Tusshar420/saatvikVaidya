import { getTableNames } from "@/server/admin/schema";
import { db } from "@/server/db";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Database · Admin Panel · Saatvik Vaidya",
};

export default async function AdminDatabasePage() {
  const tables = await getTableNames();

  const tableData = await Promise.all(
    tables.map(async (tableName) => {
      const countResult = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM \`${tableName}\``,
      );
      return {
        name: tableName,
        rowCount: Number(countResult[0]?.count ?? 0),
      };
    }),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h2 mb-2">Database Tables</h1>
        <p className="text-body text-muted">
          View and browse all database tables ({tableData.length} total)
        </p>
      </div>

      <div className="grid gap-4">
        {tableData.map((table) => (
          <Link
            key={table.name}
            href={`/admin/tables/${table.name}`}
            className="group block p-4 border border-line rounded-lg hover:bg-soft-teal hover:border-teal transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-body group-hover:text-teal transition-colors">
                  {table.name}
                </h3>
                <p className="text-small text-muted">
                  {table.rowCount.toLocaleString()} row
                  {table.rowCount !== 1 ? "s" : ""}
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted group-hover:text-teal transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
