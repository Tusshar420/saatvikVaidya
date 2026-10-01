import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ActivityList } from "@/components/admin/activity-list";
import { EbookFiles } from "@/components/admin/ebook-files";
import { EbookForm } from "@/components/admin/ebook-form";
import { Notice, parseNotice } from "@/components/admin/notice";
import { AdminPageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";
import { ebookCoverSrc, ebookHref } from "@/lib/ebooks";
import { readActivity } from "@/server/admin/audit";
import { ebookFormValues, getAdminEbook } from "@/server/admin/ebooks";
import { intId } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";
import { updateEbookAction } from "../../actions";

export const metadata: Metadata = { title: copy.ebooks.metaTitle };

export default async function EditEbookPage({
  params,
  searchParams,
}: PageProps<"/admin/ebooks/[id]/edit">) {
  await requireAdmin();
  const id = intId.safeParse((await params).id);
  const ebook = id.success ? await getAdminEbook(id.data) : null;
  if (!ebook) notFound();
  const [activity, query] = await Promise.all([
    readActivity({ resource: "Ebook", resourceId: String(ebook.id), take: 8 }),
    searchParams,
  ]);

  return (
    <>
      <AdminPageHeader
        eyebrow={copy.ebooks.eyebrow}
        title={copy.ebooks.editTitle(ebook.title)}
        action={
          <Link href={ebookHref(ebook.slug)} className={buttonClasses({ variant: "secondary" })}>
            {copy.ebooks.view}
            <ExternalLink aria-hidden className="size-4" />
          </Link>
        }
      />
      <Notice notice={parseNotice(query.notice)} />
      <EbookFiles
        ebookId={ebook.id}
        cover={ebook.coverKey ? ebookCoverSrc(ebook.id, ebook.coverKey) : null}
        file={
          ebook.fileKey && ebook.fileName && ebook.fileSizeBytes !== null
            ? { name: ebook.fileName, sizeBytes: ebook.fileSizeBytes }
            : null
        }
      />
      <EbookForm
        // A fresh form after each save, so it starts from the saved values.
        key={ebook.updatedAt.toISOString()}
        mode="edit"
        action={updateEbookAction.bind(null, ebook.id)}
        initial={ebookFormValues(ebook)}
      />
      <section
        aria-labelledby="ebook-activity"
        className="mt-8 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
      >
        <h2 id="ebook-activity" className="text-h3 text-ink">
          {copy.ebooks.activityTitle}
        </h2>
        <ActivityList items={activity} empty={copy.ebooks.activityEmpty} />
      </section>
    </>
  );
}
