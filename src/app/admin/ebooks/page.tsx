import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { ActiveBadge } from "@/components/admin/badges";
import { DataTable, EmptyRow, TBody, THead, Td, Th, Tr } from "@/components/admin/data-table";
import { Notice, parseNotice } from "@/components/admin/notice";
import { AdminPageHeader } from "@/components/admin/page-header";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";
import { ebookCoverSrc } from "@/lib/ebooks";
import { formatPaise } from "@/lib/format";
import { formatFileSize } from "@/lib/verification";
import { listAdminEbooks } from "@/server/admin/ebooks";
import { requireAdmin } from "@/server/auth/session";
import { getSetting } from "@/server/content/settings";
import { setSiteDownloadsAction } from "./actions";

export const metadata: Metadata = { title: copy.ebooks.metaTitle };

const text = copy.ebooks;

export default async function AdminEbooksPage({ searchParams }: PageProps<"/admin/ebooks">) {
  await requireAdmin("catalogue");
  const [ebooks, downloads, params] = await Promise.all([
    listAdminEbooks(),
    getSetting("ebooks.downloads"),
    searchParams,
  ]);
  const switched = params.notice === "downloadsOn" || params.notice === "downloadsOff";

  return (
    <>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
        action={
          <Link href="/admin/ebooks/new" className={buttonClasses()}>
            <Plus aria-hidden className="size-4.5" />
            {text.add}
          </Link>
        }
      />
      <Notice notice={parseNotice(params.notice)} />
      {switched && (
        <FormAlert tone="success" className="mt-6">
          {params.notice === "downloadsOn" ? text.site.savedOn : text.site.savedOff}
        </FormAlert>
      )}

      <section
        aria-labelledby="site-downloads"
        className="mt-6 flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 id="site-downloads" className="flex flex-wrap items-center gap-2 text-base font-extrabold text-ink">
            {text.site.title}
            <ActiveBadge
              active={downloads.enabled}
              activeLabel={text.downloadsOn}
              hiddenLabel={text.downloadsOff}
            />
          </h2>
          <p className="mt-1 text-small text-muted">{downloads.enabled ? text.site.on : text.site.off}</p>
        </div>
        <form action={setSiteDownloadsAction}>
          {!downloads.enabled && <input type="hidden" name="enabled" value="on" />}
          <Button type="submit" variant="secondary" className="max-sm:w-full">
            {downloads.enabled ? text.site.turnOff : text.site.turnOn}
          </Button>
        </form>
      </section>

      <p className="mt-6 text-small text-muted">{text.count(ebooks.length)}</p>
      <DataTable caption={text.title} className="mt-3">
        <THead>
          <Th className="w-16">{text.columns.cover}</Th>
          <Th>{text.columns.title}</Th>
          <Th>{text.columns.price}</Th>
          <Th>{text.columns.file}</Th>
          <Th>{text.columns.downloads}</Th>
          <Th>{text.columns.status}</Th>
          <Th>
            <span className="sr-only">{text.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {ebooks.length === 0 && <EmptyRow colSpan={7}>{text.empty}</EmptyRow>}
          {ebooks.map((ebook) => (
            <Tr key={ebook.id}>
              <Td label={text.columns.cover}>
                {ebook.coverKey ? (
                  // eslint-disable-next-line @next/next/no-img-element -- our own image route
                  <img
                    src={ebookCoverSrc(ebook.id, ebook.coverKey)}
                    alt=""
                    className="h-14 w-10 rounded-sm border border-line bg-surface-alt object-cover"
                  />
                ) : (
                  <span aria-hidden className="block h-14 w-10 rounded-sm bg-brand-soft" />
                )}
              </Td>
              <Td>
                <span className="font-bold text-ink">{ebook.title}</span>
                <code className="block text-small text-muted">{ebook.slug}</code>
              </Td>
              <Td label={text.columns.price} className="whitespace-nowrap">
                {ebook.isFree ? <Badge variant="brand">{text.free}</Badge> : formatPaise(ebook.pricePaise)}
              </Td>
              <Td label={text.columns.file}>
                {ebook.fileKey && ebook.fileSizeBytes !== null ? (
                  formatFileSize(ebook.fileSizeBytes)
                ) : (
                  <Badge variant="orange">{text.noFile}</Badge>
                )}
              </Td>
              <Td label={text.columns.downloads}>
                <ActiveBadge
                  active={ebook.downloadsEnabled}
                  activeLabel={text.downloadsOn}
                  hiddenLabel={text.downloadsOff}
                />
              </Td>
              <Td label={text.columns.status}>
                <ActiveBadge active={ebook.active} />
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2 max-md:mt-2 max-md:*:flex-1 md:justify-end">
                  <Link
                    href={`/admin/ebooks/${ebook.id}/edit`}
                    aria-label={`${copy.common.edit} ${ebook.title}`}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    <Pencil aria-hidden className="size-4" />
                    {copy.common.edit}
                  </Link>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
    </>
  );
}
