import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { admin as copy } from "@/content/admin";
import {
  newProductValues,
  readProductFormOptions,
} from "@/server/admin/catalogue";
import { requireAdmin } from "@/server/auth/session";
import { createProductAction } from "../actions";

export const metadata: Metadata = { title: copy.catalogue.metaTitle };

export default async function NewProductPage() {
  await requireAdmin();
  const options = await readProductFormOptions();
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.catalogue.eyebrow}
        title={copy.catalogue.newTitle}
        description={copy.catalogue.images.saveFirst}
      />
      <ProductForm
        mode="new"
        action={createProductAction}
        initial={newProductValues}
        options={options}
      />
    </>
  );
}
