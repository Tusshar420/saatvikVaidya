import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EbookAction } from "@/components/site/ebooks/ebook-action";
import { EbookCover } from "@/components/site/ebooks/ebook-cover";
import { PausedNote } from "@/components/site/ebooks/paused-note";
import { Badge, Eyebrow } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { ebooks as copy } from "@/content/ebooks";
import { formatPaise } from "@/lib/format";
import { formatFileSize } from "@/lib/verification";
import { effectiveRole, getSession } from "@/server/auth/session";
import { getEbookBySlug } from "@/server/ebooks/ebooks";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function load(slug: string) {
  if (slug.length > 120 || !slugPattern.test(slug)) return null;
  const session = await getSession();
  const viewer = session ? { id: session.user.id, role: effectiveRole(session, "catalogue") } : null;
  return getEbookBySlug(slug, viewer);
}

export async function generateMetadata({ params }: PageProps<"/ebooks/[slug]">): Promise<Metadata> {
  const book = await load((await params).slug);
  return book ? { title: book.title, description: book.description.slice(0, 160) } : {};
}

/** One ebook: cover, description, price and what this reader can do. */
export default async function EbookPage({ params }: PageProps<"/ebooks/[slug]">) {
  const book = await load((await params).slug);
  if (!book) notFound();

  return (
    <div className="shell py-8 sm:py-12">
      <Link href="/ebooks" className={buttonClasses({ variant: "link", className: "-ml-1 min-h-11 px-1" })}>
        <ChevronLeft aria-hidden className="size-4" />
        {copy.back}
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-12">
        <EbookCover src={book.cover} className="mx-auto w-full max-w-60 md:max-w-none" />
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            <h1 className="mt-2 text-h2 break-words text-ink">{book.title}</h1>
            {book.author && <p className="mt-2 text-body text-muted">{copy.by(book.author)}</p>}
          </div>
          <p className="flex flex-wrap items-center gap-2">
            {book.isFree ? (
              <Badge variant="brand">{copy.free}</Badge>
            ) : (
              <>
                <span className="text-h3 font-extrabold text-ink">{formatPaise(book.pricePaise)}</span>
                <span className="text-small text-muted">{copy.priceNote}</span>
              </>
            )}
            {book.owned && <Badge variant="gold">{copy.owned}</Badge>}
            {book.fileSizeBytes !== null && (
              <span className="text-small text-muted">{copy.pdf(formatFileSize(book.fileSizeBytes))}</span>
            )}
          </p>
          {book.paused && book.access !== "paused" && book.access !== "buy" && (
            <PausedNote>
              {copy.actions.pausedLine}
            </PausedNote>
          )}
          {book.awaitingPaymentOrderId ? (
            <div className="rounded-lg bg-brand-soft px-4 py-3">
              <p className="font-heading font-extrabold text-ink">{copy.actions.awaitingTitle}</p>
              <p className="mt-1 text-sm text-muted">{copy.actions.awaitingText}</p>
              <Link
                href={`/checkout/pay/${book.awaitingPaymentOrderId}`}
                className={buttonClasses({ className: "mt-3 max-sm:w-full" })}
              >
                {copy.actions.awaitingPay}
              </Link>
            </div>
          ) : (
            <EbookAction
              ebookId={book.id}
              slug={book.slug}
              title={book.title}
              access={book.access}
              paused={book.paused}
              className="sm:w-fit"
            />
          )}
          <div className="border-t border-line pt-4 text-body whitespace-pre-line text-ink">
            {book.description}
          </div>
        </div>
      </div>
    </div>
  );
}
