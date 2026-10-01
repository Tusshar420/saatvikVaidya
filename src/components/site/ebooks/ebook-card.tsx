import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ebooks as copy } from "@/content/ebooks";
import { cn } from "@/lib/cn";
import { ebookHref } from "@/lib/ebooks";
import { formatPaise } from "@/lib/format";
import type { EbookView } from "@/server/ebooks/ebooks";
import { EbookAction } from "./ebook-action";
import { EbookCover } from "./ebook-cover";

/**
 * A book in a list: cover, title, price and what the reader can do. "grid"
 * stacks the cover on top from 560 px; "row" keeps it beside the text (for
 * narrow places such as /account and an order page).
 */
export function EbookCard({
  ebook,
  headingLevel = "h2",
  layout = "grid",
}: {
  ebook: EbookView;
  headingLevel?: "h2" | "h3";
  layout?: "grid" | "row";
}) {
  const Heading = headingLevel;
  const grid = layout === "grid";
  return (
    <li
      className={cn(
        "flex gap-4 rounded-xl border border-line bg-surface p-4 shadow-card",
        grid && "sm:flex-col sm:p-5",
      )}
    >
      <Link
        href={ebookHref(ebook.slug)}
        tabIndex={-1}
        aria-hidden
        className={cn("w-24 shrink-0", grid && "sm:w-full")}
      >
        <EbookCover src={ebook.cover} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Heading className="text-base font-extrabold text-ink">
          <Link href={ebookHref(ebook.slug)} className="hover:text-teal hover:underline">
            {ebook.title}
          </Link>
        </Heading>
        {ebook.author && <p className="text-small text-muted">{copy.by(ebook.author)}</p>}
        <p className="flex flex-wrap items-center gap-2">
          {ebook.isFree ? (
            <Badge variant="teal">{copy.free}</Badge>
          ) : (
            <span className="text-lg font-extrabold text-ink">{formatPaise(ebook.pricePaise)}</span>
          )}
          {ebook.owned && <Badge variant="gold">{copy.owned}</Badge>}
        </p>
        <EbookAction
          ebookId={ebook.id}
          slug={ebook.slug}
          title={ebook.title}
          access={ebook.access}
          paused={ebook.paused}
          className="mt-auto"
        />
      </div>
    </li>
  );
}
