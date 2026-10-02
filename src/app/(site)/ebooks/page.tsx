import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { EbookCard } from "@/components/site/ebooks/ebook-card";
import { PausedNote } from "@/components/site/ebooks/paused-note";
import { Eyebrow } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ebooks as copy } from "@/content/ebooks";
import { effectiveRole, getSession } from "@/server/auth/session";
import { getSetting } from "@/server/content/settings";
import { listEbooks } from "@/server/ebooks/ebooks";

export const metadata: Metadata = {
  title: copy.metaTitle,
  description: copy.metaDescription,
};

/**
 * Ebooks: every active book, with a download (free, or bought), sign-in or
 * "Add to cart" for each reader. Read on every visit, so a purchase or a
 * switch change shows straight away.
 */
export default async function EbooksPage() {
  const session = await getSession();
  const viewer = session ? { id: session.user.id, role: effectiveRole(session, "catalogue") } : null;
  const [books, downloads] = await Promise.all([listEbooks(viewer), getSetting("ebooks.downloads")]);

  return (
    <div className="shell section-y">
      <Eyebrow>{copy.eyebrow}</Eyebrow>
      <h1 className="mt-2 text-h2 text-ink">
        {copy.title} <em className="block text-teal not-italic">{copy.titleEmphasis}</em>
      </h1>
      <p className="mt-3 max-w-2xl text-body text-muted">{copy.intro}</p>

      {!downloads.enabled && (
        <PausedNote className="mt-6 max-w-2xl">
          {copy.pausedSite}
        </PausedNote>
      )}

      {books.length === 0 ? (
        <EmptyState
          icon={<BookOpen aria-hidden />}
          title={copy.empty.title}
          description={copy.empty.line}
          className="mt-8"
          action={
            <Link href="/products" className={buttonClasses({ variant: "secondary" })}>
              {copy.empty.action}
            </Link>
          }
        />
      ) : (
        <ul
          aria-label={copy.listLabel}
          className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4"
        >
          {books.map((book) => (
            <EbookCard key={book.id} ebook={book} />
          ))}
        </ul>
      )}
    </div>
  );
}
