import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandForm } from "@/components/admin/brand-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { admin as copy } from "@/content/admin";
import { getBrand } from "@/server/admin/content";
import { fieldValuesOf, intId } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";
import { updateBrandAction } from "../../../actions";

export const metadata: Metadata = { title: copy.brands.metaTitle };

export default async function EditBrandPage({
  params,
}: PageProps<"/admin/content/brands/[id]/edit">) {
  await requireAdmin("content");
  const id = intId.safeParse((await params).id);
  const brand = id.success ? await getBrand(id.data) : null;
  if (!brand) notFound();
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.brands.eyebrow}
        title={copy.brands.editTitle(brand.name)}
      />
      <BrandForm
        mode="edit"
        action={updateBrandAction.bind(null, brand.id)}
        initial={fieldValuesOf(brand)}
      />
    </>
  );
}
