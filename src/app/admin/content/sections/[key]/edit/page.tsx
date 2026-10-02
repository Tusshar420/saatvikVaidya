import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SectionHeadingForm } from "@/components/admin/section-heading-form";
import { adminHome as copy } from "@/content/admin-site";
import { getSection } from "@/server/admin/home-content";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.sections.metaTitle };

export default async function EditSectionHeadingPage({
  params,
}: PageProps<"/admin/content/sections/[key]/edit">) {
  await requireAdmin();
  const section = await getSection((await params).key);
  if (!section) notFound();
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.sections.eyebrow}
        title={copy.sections.labels[section.key] ?? section.key}
      />
      <SectionHeadingForm
        sectionKey={section.key}
        initial={{
          eyebrow: section.eyebrow,
          title: section.title,
          titleEmphasis: section.titleEmphasis,
          description: section.description,
          linkLabel: section.linkLabel,
          linkHref: section.linkHref,
        }}
      />
    </>
  );
}
