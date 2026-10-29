import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BrandProfiles } from "@/components/site/brand/brand-profiles";
import { account as copy } from "@/content/account";
import { MAX_BRAND_PROFILES } from "@/lib/label";
import { requireUser } from "@/server/auth/session";
import { listProfiles } from "@/server/brand/profiles";

export const metadata: Metadata = {
  title: copy.brands.metaTitle,
  robots: { index: false, follow: false },
};

/** The signed-in user's saved brands: the same ones they pick from on Launch. */
export default async function BrandDetailsPage() {
  const { user } = await requireUser("/account/brands");
  const profiles = await listProfiles(user.id);
  return (
    <>
      <PageHero eyebrow={copy.brands.eyebrow} title={copy.brands.title} description={copy.brands.intro} />
      <div className="bg-cream pt-5 pb-19 sm:pt-7 md:pb-24">
      <div className="shell mx-auto max-w-3xl">
        <Link
          href="/account"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-brand underline-offset-4 hover:underline"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {copy.brands.back}
        </Link>
        <p className="mt-1 text-small font-semibold text-muted">
          {copy.brands.count(profiles.length, MAX_BRAND_PROFILES)}
        </p>
        <div className="mt-6">
          <BrandProfiles profiles={profiles} selectedId={null} max={MAX_BRAND_PROFILES} context="account" />
        </div>
      </div>
      </div>
    </>
  );
}
