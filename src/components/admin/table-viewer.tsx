"use client";

import { ColumnInfo } from "@/server/admin/schema";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface TableViewerProps {
  tableName: string;
  columns: ColumnInfo[];
  initialData: Record<string, unknown>[];
  totalRows: number;
}

export function TableViewer({
  tableName,
  columns,
  initialData,
  totalRows,
}: TableViewerProps) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);

  const pageSize = 50;
  const maxPages = Math.ceil(totalRows / pageSize);

  const handleLoadMore = async (direction: "next" | "prev") => {
    const newPage = direction === "next" ? page + 1 : Math.max(0, page - 1);
    if (newPage < 0 || newPage >= maxPages) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/tables/${tableName}?page=${newPage}&limit=${pageSize}`,
      );
      if (!response.ok) throw new Error("Failed to load table data");
      const result = await response.json();
      setData(result.data);
      setPage(newPage);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null) return "NULL";
    if (value === undefined) return "—";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "object")
      return JSON.stringify(value, null, 0).substring(0, 100);
    return String(value).substring(0, 200);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-line rounded-lg">
        <table className="w-full text-small">
          <thead>
            <tr className="border-b border-line bg-soft-teal">
              {columns.map((col) => (
                <th
                  key={col.name}
                  className="px-4 py-3 text-left font-semibold text-body"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="text-body font-semibold">{col.name}</div>
                    <div className="text-label text-muted">
                      {col.type}
                      {col.isPrimary && " (PK)"}
                      {col.nullable && " (NULL)"}
                    </div>
                  </div>
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
                  No data found
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-line hover:bg-soft-teal/30"
                >
                  {columns.map((col) => (
                    <td
                      key={col.name}
                      className="px-4 py-3 text-body align-top break-words max-w-xs"
                    >
                      <code className="text-label bg-soft text-dark rounded px-2 py-1 inline-block max-w-full truncate">
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

      {maxPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-small text-muted">
            Showing rows {(page * pageSize) + 1}–{Math.min((page + 1) * pageSize, totalRows)} of {totalRows.toLocaleString()}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon="start"
              onClick={() => handleLoadMore("prev")}
              disabled={page === 0 || isLoading}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 px-4">
              Page {page + 1} of {maxPages}
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon="end"
              onClick={() => handleLoadMore("next")}
              disabled={page >= maxPages - 1 || isLoading}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
