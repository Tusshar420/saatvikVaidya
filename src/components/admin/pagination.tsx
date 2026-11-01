import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";
import { listHref } from "@/lib/admin-sort";

/** Previous / next links that keep the current filters. */
export function Pagination({
  basePath,
  params,
  page,
  pageCount,
  pageParam = "page",
  hash,
}: {
  basePath: string;
  /** Current query values (filters), without `page`. */
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
  /** Query name of the page number, for a page with two paged lists. */
  pageParam?: string;
  /** Section to scroll back to. */
  hash?: string;
}) {
  if (pageCount <= 1) return null;
  const href = (target: number) =>
    listHref(basePath, { ...params, [pageParam]: target > 1 ? String(target) : undefined }, hash);
  const linkClass = buttonClasses({ variant: "secondary", size: "sm" });
  return (
    <nav
      aria-label={copy.common.page(page, pageCount)}
      className="mt-6 flex items-center justify-between gap-3"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} className={linkClass}>
          <ChevronLeft aria-hidden className="size-4" />
          {copy.common.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-small text-muted">
        {copy.common.page(page, pageCount)}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className={linkClass}>
          {copy.common.next}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
