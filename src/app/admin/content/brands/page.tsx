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
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";
import { listBrands } from "@/server/admin/content";
import { requireAdmin } from "@/server/auth/session";
import { deleteBrandAction } from "../actions";

export const metadata: Metadata = { title: copy.brands.metaTitle };

const text = copy.brands;

export default async function BrandsPage({
  searchParams,
}: PageProps<"/admin/content/brands">) {
  await requireAdmin();
  const [brands, params] = await Promise.all([listBrands(), searchParams]);

  return (
    <>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
        action={
          <Link href="/admin/content/brands/new" className={buttonClasses()}>
            <Plus aria-hidden className="size-4.5" />
            {text.add}
          </Link>
        }
      />
      <Notice notice={parseNotice(params.notice)} />
      <DataTable caption={text.title} className="mt-6">
        <THead>
          <Th className="w-16">{text.columns.logo}</Th>
          <Th>{text.columns.name}</Th>
          <Th>{text.columns.status}</Th>
          <Th>{text.columns.sortOrder}</Th>
          <Th>
            <span className="sr-only">{text.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {brands.length === 0 && <EmptyRow colSpan={5}>{text.empty}</EmptyRow>}
          {brands.map((brand) => (
            <Tr key={brand.id}>
              <Td label={text.columns.logo}>
                {brand.logoSrc ? (
                  // Plain <img>: admin-entered path, shown small.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brand.logoSrc}
                    alt=""
                    className="size-10 rounded-md border border-line object-contain"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="grid size-10 place-items-center rounded-md bg-teal-soft text-xs font-black text-teal"
                  >
                    {brand.monogram}
                  </span>
                )}
              </Td>
              <Td>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ink">{brand.name}</span>
                  {brand.featured && <Badge variant="gold">{text.featured}</Badge>}
                </span>
                <code className="block text-small text-muted">{brand.key}</code>
              </Td>
              <Td label={text.columns.status}>
                <ActiveBadge active={brand.active} />
              </Td>
              <Td label={text.columns.sortOrder}>{brand.sortOrder}</Td>
              <Td>
                <RowActions
                  editHref={`/admin/content/brands/${brand.id}/edit`}
                  deleteAction={deleteBrandAction}
                  id={brand.id}
                  name={brand.name}
                />
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
    </>
  );
}
