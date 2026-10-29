import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { notFoundScreen as copy } from "@/content/errors";

/**
 * The "page not found" screen: inside the site shell for a missing product
 * or ebook, and on its own (under the logo) for an address that matches no
 * page at all.
 */
export function NotFoundScreen() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
      <EmptyState
        as="h1"
        icon={<SearchX aria-hidden />}
        title={copy.title}
        description={copy.description}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/" className={buttonClasses()}>
              {copy.home}
            </Link>
            <Link href="/products" className={buttonClasses({ variant: "secondary" })}>
              {copy.products}
            </Link>
          </div>
        }
      />
    </div>
  );
}
