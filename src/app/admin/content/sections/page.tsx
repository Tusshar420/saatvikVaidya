import type { Metadata } from "next";
import { Notice, parseNotice } from "@/components/admin/notice";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SectionsForm } from "@/components/admin/sections-form";
import { adminHome as copy } from "@/content/admin-site";
import { listSections } from "@/server/admin/home-content";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.sections.metaTitle };

export default async function SectionsPage({ searchParams }: PageProps<"/admin/content/sections">) {
  await requireAdmin();
  const [sections, query] = await Promise.all([listSections(), searchParams]);
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.sections.eyebrow}
        title={copy.sections.title}
        description={copy.sections.description}
      />
      <Notice notice={parseNotice(query.notice)} />
      <SectionsForm
        rows={sections.map((s) => ({ key: s.key, enabled: s.enabled, sortOrder: s.sortOrder }))}
      />
    </>
  );
}
