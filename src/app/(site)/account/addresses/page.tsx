import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AddressBook } from "@/components/site/account/address-book";
import { account as copy } from "@/content/account";
import { requireUser } from "@/server/auth/session";
import { listAddresses, MAX_ADDRESSES } from "@/server/checkout/addresses";

export const metadata: Metadata = {
  title: copy.addresses.metaTitle,
  robots: { index: false, follow: false },
};

/** The signed-in user's saved delivery addresses. */
export default async function AddressesPage() {
  const { user } = await requireUser("/account/addresses");
  const addresses = await listAddresses(user.id);
  return (
    <>
      <PageHero eyebrow={copy.addresses.eyebrow} title={copy.addresses.title} description={copy.addresses.intro} />
      <div className="bg-cream pt-5 pb-19 sm:pt-7 md:pb-24">
      <div className="shell mx-auto max-w-3xl">
        <Link
          href="/account"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-brand underline-offset-4 hover:underline"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {copy.addresses.back}
        </Link>
        <div className="mt-4">
          <AddressBook addresses={addresses} max={MAX_ADDRESSES} />
        </div>
      </div>
      </div>
    </>
  );
}
