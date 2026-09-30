import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";

/** Previous / next links that keep the current filters. */
export function Pagination({
  basePath,
  params,
  page,
  pageCount,
}: {
  basePath: string;
  /** Current query values (filters), without `page`. */
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return text ? `${basePath}?${text}` : basePath;
  };
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
