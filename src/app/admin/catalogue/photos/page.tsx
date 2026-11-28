import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BulkPhotoUpload } from "@/components/admin/bulk-photo-upload";
import { LabelPhotos } from "@/components/admin/label-photos";
import { AdminPageHeader } from "@/components/admin/page-header";
import { admin as copy } from "@/content/admin";
import { MAX_PRODUCT_IMAGES, productImageUpload } from "@/lib/catalogue";
import { formatFileSize } from "@/lib/verification";
import { listPhotoUploadProducts } from "@/server/admin/catalogue";
import { intId } from "@/server/admin/form";
import { labelPhotoStatus } from "@/server/admin/label-photos";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.catalogue.bulkPhotos.metaTitle };

const text = copy.catalogue.bulkPhotos;

/**
 * Many product photos at once: pick a medicine, its label variant and an
 * image per row, then upload them all. `?product=<id>` starts with that one.
 * Above it, "Client label photos" loads the client's label photos in one go.
 */
export default async function BulkPhotosPage({
  searchParams,
}: PageProps<"/admin/catalogue/photos">) {
  await requireAdmin("catalogue", "/admin/catalogue/photos");
  const [products, query, labels] = await Promise.all([
    listPhotoUploadProducts(),
    searchParams,
    labelPhotoStatus(),
  ]);
  const product = intId.safeParse(query.product);
  return (
    <>
      <Link
        href="/admin/catalogue"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-brand hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {text.back}
      </Link>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description(
          MAX_PRODUCT_IMAGES,
          formatFileSize(productImageUpload.maxBytes),
        )}
      />
      <LabelPhotos products={labels.products} photos={labels.photos} />
      <BulkPhotoUpload
        products={products}
        initialProductId={product.success ? product.data : undefined}
      />
    </>
  );
}
