import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { ebooks as copy } from "@/content/ebooks";
import type { EbookView } from "@/server/ebooks/ebooks";
import { EbookCard } from "./ebook-card";

/** "My ebooks" on /account: the books the user bought, ready to download. */
export function MyEbooks({ ebooks, className }: { ebooks: EbookView[]; className?: string }) {
  return (
    <Card as="section" aria-labelledby="account-ebooks" className={className ?? "mt-5"}>
      <h2 id="account-ebooks" className="text-h3 text-ink">
        {copy.account.title}
      </h2>
      {ebooks.length === 0 ? (
        <div className="mt-3 flex flex-col items-start gap-3">
          <p className="text-sm text-muted">{copy.account.empty}</p>
          <Link href="/ebooks" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            {copy.account.browse}
          </Link>
        </div>
      ) : (
        <ul aria-label={copy.account.title} className="mt-4 grid gap-4 md:grid-cols-2">
          {ebooks.map((ebook) => (
            <EbookCard key={ebook.id} ebook={ebook} headingLevel="h3" layout="row" />
          ))}
        </ul>
      )}
    </Card>
  );
}
