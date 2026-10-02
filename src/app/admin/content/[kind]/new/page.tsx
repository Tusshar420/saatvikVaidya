import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { HomeContentForm } from "@/components/admin/home-content-form";
import { adminHome as copy, homeKindByPath, homeKinds } from "@/content/admin-site";
import { requireAdmin } from "@/server/auth/session";
import { createHomeAction } from "../../home-actions";

export const metadata: Metadata = { title: "New homepage item" };

export default async function NewHomeContentPage({ params }: PageProps<"/admin/content/[kind]/new">) {
  await requireAdmin("content");
  const kind = homeKindByPath[(await params).kind];
  if (!kind) notFound();
  const spec = homeKinds[kind];
  // Blank text, "active" off, and the first option of each choice.
  const initial: Record<string, string | number | boolean> = { key: "" };
  for (const field of spec.fields) {
    if (field.name === "sortOrder") initial[field.name] = 100;
    else if (field.type === "checkbox") initial[field.name] = false;
    else if (field.type === "select") initial[field.name] = field.options?.[0]?.value ?? "";
    else initial[field.name] = "";
  }
  return (
    <>
      <AdminPageHeader eyebrow={copy.sections.eyebrow} title={copy.newTitle(spec.label)} />
      <HomeContentForm kind={kind} mode="new" action={createHomeAction.bind(null, kind)} initial={initial} />
    </>
  );
}
