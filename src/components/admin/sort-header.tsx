import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Th } from "@/components/admin/data-table";
import { admin as copy } from "@/content/admin";
import { nextSort, type Sort, type SortDir } from "@/lib/admin-sort";
import { cn } from "@/lib/cn";

/**
 * A column header that sorts the list: the first click sorts by this column,
 * the next one flips the direction. Phones hide table headers, so every list
 * with these also has a "Sort by" select in its filter bar.
 */
export function SortTh<K extends string>({
  column,
  sort,
  href,
  firstDir = "asc",
  className,
  children,
}: {
  column: K;
  sort: Sort<K>;
  /** The list URL for a sort (keeps the filters, drops the page). */
  href: (sort: Sort<K>) => string;
  /** Direction of the first click: "desc" for numbers where big matters most. */
  firstDir?: SortDir;
  className?: string;
  children: ReactNode;
}) {
  const active = sort.key === column;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Th
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className={cn("p-0", className)}
    >
      <Link
        href={href(nextSort(sort, column, firstDir))}
        scroll={false}
        aria-label={copy.common.sortColumn(String(children))}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 px-4 py-3 uppercase transition hover:text-ink",
          active && "text-ink",
        )}
      >
        {children}
        <Icon aria-hidden className={cn("size-3.5 shrink-0", !active && "opacity-50")} />
      </Link>
    </Th>
  );
}
