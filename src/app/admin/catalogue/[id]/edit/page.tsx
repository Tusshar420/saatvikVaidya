import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ActivityList } from "@/components/admin/activity-list";
import { Notice, parseNotice } from "@/components/admin/notice";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { ProductImages } from "@/components/admin/product-images";
import { buttonClasses } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";
import { productHref, productImageSrc } from "@/lib/catalogue";
import {
  getAdminProduct,
  productFormValues,
  readProductFormOptions,
} from "@/server/admin/catalogue";
import { readActivity } from "@/server/admin/audit";
import { intId } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";
import {
  deleteProductImageAction,
  moveProductImageAction,
  updateProductAction,
  updateProductImageAltAction,
} from "../../actions";

export const metadata: Metadata = { title: copy.catalogue.metaTitle };

export default async function EditProductPage({
  params,
  searchParams,
}: PageProps<"/admin/catalogue/[id]/edit">) {
  await requireAdmin("catalogue");
  const id = intId.safeParse((await params).id);
  const product = id.success ? await getAdminProduct(id.data) : null;
  if (!product) notFound();
  const [options, activity, query] = await Promise.all([
    readProductFormOptions(),
    readActivity({ resource: "Product", resourceId: String(product.id), take: 8 }),
    searchParams,
  ]);

  return (
    <>
      <AdminPageHeader
        eyebrow={copy.catalogue.eyebrow}
        title={copy.catalogue.editTitle(product.name)}
        action={
          product.active ? (
            <Link
              href={productHref(product.slug)}
              className={buttonClasses({ variant: "secondary" })}
            >
              {copy.catalogue.view}
              <ExternalLink aria-hidden className="size-4" />
            </Link>
          ) : undefined
        }
      />
      <Notice notice={parseNotice(query.notice)} />
      <ProductImages
        productId={product.id}
        images={product.images.map((image) => ({
          id: image.id,
          src: productImageSrc(image.id),
          alt: image.alt,
        }))}
        moveAction={moveProductImageAction}
        deleteAction={deleteProductImageAction}
        altAction={updateProductImageAltAction}
      />
      <ProductForm
        // A fresh form after each save, so it starts from the saved values.
        key={product.updatedAt.toISOString()}
        mode="edit"
        action={updateProductAction.bind(null, product.id)}
        initial={productFormValues(product)}
        options={options}
      />
      <section
        aria-labelledby="product-activity"
        className="mt-8 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
      >
        <h2 id="product-activity" className="text-h3 text-ink">
          {copy.catalogue.activityTitle}
        </h2>
        <ActivityList items={activity} empty={copy.catalogue.activityEmpty} />
      </section>
    </>
  );
}
