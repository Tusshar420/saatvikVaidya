import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { HomeContentForm } from "@/components/admin/home-content-form";
import { adminHome as copy, homeKindByPath, homeKinds } from "@/content/admin-site";
import { intId } from "@/server/admin/form";
import { getHomeRow, homeFormValues } from "@/server/admin/home-content";
import { requireAdmin } from "@/server/auth/session";
import { updateHomeAction } from "../../../home-actions";

export const metadata: Metadata = { title: "Edit homepage item" };

export default async function EditHomeContentPage({
  params,
}: PageProps<"/admin/content/[kind]/[id]/edit">) {
  await requireAdmin("content");
  const { kind: path, id: rawId } = await params;
  const kind = homeKindByPath[path];
  const id = intId.safeParse(rawId);
  if (!kind || !id.success) notFound();
  const row = await getHomeRow(kind, id.data);
  if (!row) notFound();
  const spec = homeKinds[kind];
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.sections.eyebrow}
        title={copy.editTitle(String(row[spec.titleField] ?? row.key))}
      />
      <HomeContentForm
        kind={kind}
        mode="edit"
        action={updateHomeAction.bind(null, kind, id.data)}
        initial={homeFormValues(row)}
      />
    </>
  );
}
