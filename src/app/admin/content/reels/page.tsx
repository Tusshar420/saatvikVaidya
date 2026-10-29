import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ActiveBadge } from "@/components/admin/badges";
import {
  DataTable,
  EmptyRow,
  TBody,
  THead,
  Td,
  Th,
  Tr,
} from "@/components/admin/data-table";
import { Notice, parseNotice } from "@/components/admin/notice";
import { AdminPageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { buttonClasses } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";
import { listReels } from "@/server/admin/content";
import { requireAdmin } from "@/server/auth/session";
import { deleteReelAction } from "../actions";

export const metadata: Metadata = { title: copy.reels.metaTitle };

const text = copy.reels;

export default async function ReelsPage({
  searchParams,
}: PageProps<"/admin/content/reels">) {
  await requireAdmin("content");
  const [reels, params] = await Promise.all([listReels(), searchParams]);

  return (
    <>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
        action={
          <Link href="/admin/content/reels/new" className={buttonClasses()}>
            <Plus aria-hidden className="size-4.5" />
            {text.add}
          </Link>
        }
      />
      <Notice notice={parseNotice(params.notice)} />
      <DataTable caption={text.title} className="mt-6">
        <THead>
          <Th>{text.columns.title}</Th>
          <Th>{text.columns.key}</Th>
          <Th>{text.columns.type}</Th>
          <Th>{text.columns.filter}</Th>
          <Th>{text.columns.status}</Th>
          <Th>{text.columns.sortOrder}</Th>
          <Th>
            <span className="sr-only">{text.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {reels.length === 0 && <EmptyRow colSpan={7}>{text.empty}</EmptyRow>}
          {reels.map((reel) => (
            <Tr key={reel.id}>
              <Td className="font-bold break-words text-ink md:max-w-72">
                {reel.title}
              </Td>
              <Td label={text.columns.key}>
                <code className="text-small break-all">{reel.key}</code>
              </Td>
              <Td label={text.columns.type}>{text.mediaKinds[reel.mediaKind]}</Td>
              <Td label={text.columns.filter}>{text.types[reel.type]}</Td>
              <Td label={text.columns.status}>
                <ActiveBadge active={reel.active} />
              </Td>
              <Td label={text.columns.sortOrder}>{reel.sortOrder}</Td>
              <Td>
                <RowActions
                  editHref={`/admin/content/reels/${reel.id}/edit`}
                  deleteAction={deleteReelAction}
                  id={reel.id}
                  name={reel.title}
                />
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
    </>
  );
}
