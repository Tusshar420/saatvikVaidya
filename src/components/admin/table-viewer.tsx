"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";
import type { ColumnInfo } from "@/server/admin/schema";

const PAGE_SIZE = 50;

type TableViewerProps = {
  tableName: string;
  columns: ColumnInfo[];
  initialData: Record<string, unknown>[];
  totalRows: number;
};

function formatValue(value: unknown): string {
  if (value === null) return "NULL";
  if (value === undefined) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 100);
  return String(value).slice(0, 200);
}

/**
 * Raw rows of one table, 50 at a time. Tables are wide, so this one scrolls
 * sideways inside its frame (the page itself doesn't).
 */
export function TableViewer({
  tableName,
  columns,
  initialData,
  totalRows,
}: TableViewerProps) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const pageCount = Math.ceil(totalRows / PAGE_SIZE);

  async function load(target: number) {
    if (target < 0 || target >= pageCount) return;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/admin/tables/${encodeURIComponent(tableName)}?page=${target}&limit=${PAGE_SIZE}`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = (await response.json()) as {
        data: Record<string, unknown>[];
      };
      setData(result.data);
      setPage(target);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-small">
          <caption className="sr-only">{tableName}</caption>
          <thead>
            <tr className="border-b border-line bg-surface-alt">
              {columns.map((col) => (
                <th
                  key={col.name}
                  scope="col"
                  className="px-4 py-3 text-left align-top font-bold text-ink"
                >
                  {col.name}
                  <span className="block text-xs font-medium text-muted">
                    {col.type}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-muted"
                >
                  {copy.database.noRows}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr key={index} className="border-b border-line last:border-0">
                  {columns.map((col) => (
                    <td
                      key={col.name}
                      className="max-w-xs px-4 py-2.5 align-top break-words"
                    >
                      <code className="inline-block max-w-full truncate rounded-sm bg-surface-alt px-1.5 py-0.5 text-xs text-ink">
                        {formatValue(row[col.name])}
                      </code>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {failed && <FormAlert>{copy.database.loadFailed}</FormAlert>}

      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-small text-muted">
            {copy.database.showing(
              page * PAGE_SIZE + 1,
              Math.min((page + 1) * PAGE_SIZE, totalRows),
              totalRows,
            )}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronLeft aria-hidden className="size-4" />}
              onClick={() => load(page - 1)}
              disabled={page === 0 || loading}
            >
              {copy.common.previous}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => load(page + 1)}
              disabled={page >= pageCount - 1 || loading}
            >
              {copy.common.next}
              <ChevronRight aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
