import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { catalogue as copy } from "@/content/catalogue";

/** Previous / next links that keep the current filters. */
export function CataloguePagination({
  basePath,
  params,
  page,
  pageCount,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(params)) {
      if (value) query.set(name, value);
    }
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return text ? `${basePath}?${text}` : basePath;
  };
  const linkClass = buttonClasses({ variant: "secondary", size: "sm" });
  return (
    <nav
      aria-label={copy.pagination.label(page, pageCount)}
      className="mt-8 flex items-center justify-between gap-3"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={linkClass}>
          <ChevronLeft aria-hidden className="size-4" />
          {copy.pagination.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-small text-muted">
        {copy.pagination.label(page, pageCount)}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={linkClass}>
          {copy.pagination.next}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
