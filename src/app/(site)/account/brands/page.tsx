import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BrandProfiles } from "@/components/site/brand/brand-profiles";
import { Eyebrow } from "@/components/ui/badge";
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
    <div className="shell section-y">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/account"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-teal underline-offset-4 hover:underline"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {copy.brands.back}
        </Link>
        <Eyebrow className="mt-2">{copy.brands.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-h2 text-ink">{copy.brands.title}</h1>
        <p className="mt-2 text-body text-muted">{copy.brands.intro}</p>
        <p className="mt-1 text-small font-semibold text-muted">
          {copy.brands.count(profiles.length, MAX_BRAND_PROFILES)}
        </p>
        <div className="mt-6">
          <BrandProfiles profiles={profiles} selectedId={null} max={MAX_BRAND_PROFILES} context="account" />
        </div>
      </div>
    </div>
  );
}
