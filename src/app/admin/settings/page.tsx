import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ComingSoon } from "@/components/ui/empty-state";
import { admin as copy } from "@/content/admin";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.settings.metaTitle };

export default async function AdminSettingsPage() {
  await requireAdmin();
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.settings.eyebrow}
        title={copy.settings.title}
        description={copy.settings.description}
      />
      <ComingSoon
        as="h2"
        icon={<Settings aria-hidden />}
        title={copy.settings.soonTitle}
        description={copy.settings.soonBody}
        className="mt-6"
      />
    </>
  );
}
