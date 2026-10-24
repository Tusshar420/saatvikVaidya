import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { notFound } from "next/navigation";
import {
  BackupCodesForm,
  OpenAdminLink,
  TwoFactorSetup,
} from "@/components/site/account/two-factor-setup";
import { Card } from "@/components/ui/card";
import { adminSecurity } from "@/content/admin-security";
import { requireUser } from "@/server/auth/session";

const copy = adminSecurity.twoFactor;

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false, follow: false },
};

/**
 * Two-factor setup for admins. Admin pages send an admin here until it is
 * on. Anyone who isn't an admin gets a 404.
 */
export default async function TwoFactorPage() {
  const { user } = await requireUser("/account/two-factor");
  if (user.role !== "admin") notFound();

  return (
    <>
      <PageHero eyebrow={copy.metaTitle} title={copy.title} />
      <div className="bg-cream pt-5 pb-19 sm:pt-7 md:pb-24">
      <div className="shell mx-auto max-w-3xl">
        <Card>
          {user.twoFactorEnabled ? (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-muted">{copy.introEnabled}</p>
              <BackupCodesForm />
              <p className="text-sm text-muted">{copy.disableNote}</p>
              <OpenAdminLink />
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-muted">{copy.introRequired}</p>
              <TwoFactorSetup />
            </div>
          )}
        </Card>
      </div>
      </div>
    </>
  );
}
