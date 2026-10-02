import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BackupCodesForm,
  OpenAdminLink,
  TwoFactorSetup,
} from "@/components/site/account/two-factor-setup";
import { Eyebrow } from "@/components/ui/badge";
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
    <div className="shell section-y">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>{copy.metaTitle}</Eyebrow>
        <h1 className="mt-2 text-h2 text-ink">{copy.title}</h1>
        <Card className="mt-6">
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
  );
}
