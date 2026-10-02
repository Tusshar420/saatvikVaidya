import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { admin as copy } from "@/content/admin";
import { getTableNames, getRowCount } from "@/server/admin/schema";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.database.metaTitle };

/** Read-only list of every table with its row count. */
export default async function AdminDatabasePage() {
  await requireAdmin("database");
  const tables = await getTableNames();
  const counts = await Promise.all(tables.map(getRowCount));

  return (
    <>
      <AdminPageHeader
        eyebrow={copy.database.eyebrow}
        title={copy.database.title}
        description={copy.database.description(tables.length)}
      />
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((name, index) => (
          <li key={name}>
            <Link
              href={`/admin/tables/${name}`}
              className="group flex min-h-16 items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-card transition hover:border-teal"
            >
              <span className="min-w-0">
                <span className="block truncate font-bold text-ink group-hover:text-teal">
                  {name}
                </span>
                <span className="text-small text-muted">
                  {copy.database.rows(counts[index])}
                </span>
              </span>
              <ArrowRight
                aria-hidden
                className="size-4.5 shrink-0 text-muted group-hover:text-teal"
              />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
