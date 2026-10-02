import type { Metadata } from "next";
import { BrandForm } from "@/components/admin/brand-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { admin as copy } from "@/content/admin";
import { requireAdmin } from "@/server/auth/session";
import { createBrandAction } from "../../actions";

export const metadata: Metadata = { title: copy.brands.newTitle };

export default async function NewBrandPage() {
  await requireAdmin("content");
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.brands.eyebrow}
        title={copy.brands.newTitle}
      />
      <BrandForm
        mode="new"
        action={createBrandAction}
        initial={{ tone: "TEAL", sortOrder: 100, active: false }}
      />
    </>
  );
}
