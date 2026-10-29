import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EbookForm } from "@/components/admin/ebook-form";
import { admin as copy } from "@/content/admin";
import { newEbookValues } from "@/server/admin/ebooks";
import { requireAdmin } from "@/server/auth/session";
import { createEbookAction } from "../actions";

export const metadata: Metadata = { title: copy.ebooks.metaTitle };

export default async function NewEbookPage() {
  await requireAdmin("catalogue");
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.ebooks.eyebrow}
        title={copy.ebooks.newTitle}
        description={copy.ebooks.files.saveFirst}
      />
      <EbookForm mode="new" action={createEbookAction} initial={newEbookValues} />
    </>
  );
}
