import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AddressBook } from "@/components/site/account/address-book";
import { Eyebrow } from "@/components/ui/badge";
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
    <div className="shell section-y">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/account"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-brand underline-offset-4 hover:underline"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {copy.addresses.back}
        </Link>
        <Eyebrow className="mt-2">{copy.addresses.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-h2 text-ink">{copy.addresses.title}</h1>
        <p className="mt-2 text-body text-muted">{copy.addresses.intro}</p>
        <div className="mt-6">
          <AddressBook addresses={addresses} max={MAX_ADDRESSES} />
        </div>
      </div>
    </div>
  );
}
