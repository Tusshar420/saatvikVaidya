import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { ActiveBadge } from "@/components/admin/badges";
import { DataTable, EmptyRow, TBody, THead, Td, Th, Tr } from "@/components/admin/data-table";
import { Notice, parseNotice } from "@/components/admin/notice";
import { AdminPageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { buttonClasses } from "@/components/ui/button";
import { adminHome as copy, homeKindByPath, homeKinds } from "@/content/admin-site";
import { listHomeRows } from "@/server/admin/home-content";
import { requireAdmin } from "@/server/auth/session";
import { deleteHomeAction } from "../home-actions";

export async function generateMetadata({ params }: PageProps<"/admin/content/[kind]">): Promise<Metadata> {
  const kind = homeKindByPath[(await params).kind];
  return { title: kind ? homeKinds[kind].plural : copy.sections.metaTitle };
}

/** List of one kind of homepage item: /admin/content/hero, /offers, /stats ... */
export default async function HomeContentListPage({
  params,
  searchParams,
}: PageProps<"/admin/content/[kind]">) {
  await requireAdmin("content");
  const kind = homeKindByPath[(await params).kind];
  if (!kind) notFound();
  const spec = homeKinds[kind];
  const [rows, query] = await Promise.all([listHomeRows(kind), searchParams]);

  return (
    <>
      <AdminPageHeader
        eyebrow={copy.sections.eyebrow}
        title={spec.plural}
        action={
          <Link href={`/admin/content/${spec.path}/new`} className={buttonClasses()}>
            <Plus aria-hidden className="size-4.5" />
            {copy.add(spec.label)}
          </Link>
        }
      />
      <Notice notice={parseNotice(query.notice)} />
      <DataTable caption={spec.plural} className="mt-6">
        <THead>
          <Th>{copy.columns.title}</Th>
          <Th>{copy.columns.key}</Th>
          <Th>{copy.columns.status}</Th>
          <Th>{copy.columns.sortOrder}</Th>
          <Th>
            <span className="sr-only">{copy.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {rows.length === 0 && <EmptyRow colSpan={5}>{copy.empty}</EmptyRow>}
          {rows.map((row) => {
            const id = row.id as number;
            const name = String(row[spec.titleField] ?? row.key);
            return (
              <Tr key={id}>
                <Td className="font-bold break-words text-ink md:max-w-72">{name}</Td>
                <Td label={copy.columns.key}>
                  <code className="text-small break-all">{String(row.key)}</code>
                </Td>
                <Td label={copy.columns.status}>
                  <ActiveBadge active={row.active === true} />
                </Td>
                <Td label={copy.columns.sortOrder}>{String(row.sortOrder)}</Td>
                <Td>
                  <RowActions
                    editHref={`/admin/content/${spec.path}/${id}/edit`}
                    deleteAction={deleteHomeAction.bind(null, kind)}
                    id={id}
                    name={name}
                  />
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </DataTable>
    </>
  );
}
