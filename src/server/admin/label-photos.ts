import "server-only";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { productImageUpload } from "@/lib/catalogue";
import { db } from "@/server/db";
import { deleteFilesQuietly, getStorage, newFileKey } from "@/server/storage";
import { checkUpload } from "@/server/storage/files";
import {
  LABEL_PHOTOS_DIR,
  photoAlt,
  photoSets,
  photoVariantKey,
  photoVariantStyle,
  preparedFileName,
  type PhotoSet,
} from "@/server/seed/product-photos";
import { createdFields, logAdminAction } from "./audit";

// "Load label photos" on /admin/catalogue/photos: puts the client's label
// photos (src/server/seed/product-photos.ts, web copies committed in
// prisma/product-photos/) on the catalogue. It runs inside the site, so the
// files go to the same Storage the site reads from.
//
// For each medicine in the list, every pack size with that name (never the
// seeded samples) gets one Build Your Brand variant per photo, named after
// the label's colour (the default first), photo 1 as its shop photo and each
// photo as its variant's photo. A product that already has photos or its own
// variants is left alone, so admin work is never overwritten and pressing
// the button again does nothing.

type Options = { sets?: readonly PhotoSet[]; folder?: string };

type Ready = { id: number; name: string; set: PhotoSet };

/** Products with no photos and no variants of their own, with their set. */
async function readyProducts(sets: readonly PhotoSet[]): Promise<Ready[]> {
  const names = sets.flatMap((set) => set.products);
  const rows = await db.product.findMany({
    where: { name: { in: names }, isSample: false, images: { none: {} }, variants: { none: {} } },
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });
  return rows.map((row) => ({ ...row, set: sets.find((set) => set.products.includes(row.name))! }));
}

/** How many products would get photos, and how many photos in all. */
export async function labelPhotoStatus(options: Options = {}) {
  const ready = await readyProducts(options.sets ?? photoSets);
  return {
    products: ready.length,
    photos: ready.reduce((sum, product) => sum + product.set.photos.length + 1, 0),
  };
}

export type LabelPhotoResult =
  | { ok: true; products: number; photos: number }
  | { ok: false; error: "missing"; file: string };

/** Loads the photos onto every ready product; see the note at the top. */
export async function loadLabelPhotos(actorId: string, options: Options = {}): Promise<LabelPhotoResult> {
  const folder = resolve(options.folder ?? LABEL_PHOTOS_DIR);
  const ready = await readyProducts(options.sets ?? photoSets);

  // Read and check every file first, so a missing one changes nothing.
  const files = new Map<string, Uint8Array>();
  for (const photo of ready.flatMap((product) => product.set.photos)) {
    if (files.has(photo.file)) continue;
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await readFile(join(folder, preparedFileName(photo.file))));
    } catch {
      return { ok: false, error: "missing", file: preparedFileName(photo.file) };
    }
    const checked = checkUpload(bytes, productImageUpload);
    if (!checked.ok || checked.contentType !== "image/jpeg") {
      return { ok: false, error: "missing", file: preparedFileName(photo.file) };
    }
    files.set(photo.file, bytes);
  }

  let photos = 0;
  let products = 0;
  for (const product of ready) {
    const { set } = product;
    const bytesOf = (index: number) => files.get(set.photos[index].file)!;
    // Files first; if the database step fails they're removed again.
    const generalKey = newFileKey("products", String(product.id), "jpg");
    const variantKeys = set.photos.map(() => newFileKey("products", String(product.id), "jpg"));
    const keys = [generalKey, ...variantKeys];
    await getStorage().put(generalKey, bytesOf(0));
    for (let index = 0; index < variantKeys.length; index++) {
      await getStorage().put(variantKeys[index], bytesOf(index));
    }
    let added: boolean;
    try {
      added = await db.$transaction(async (tx) => {
        // Checked again inside the transaction: an admin may have just added
        // a photo or variants by hand.
        const [images, variants] = await Promise.all([
          tx.productImage.count({ where: { productId: product.id } }),
          tx.productVariant.count({ where: { productId: product.id } }),
        ]);
        if (images > 0 || variants > 0) return false;
        await tx.productVariant.createMany({
          data: set.photos.map((photo, index) => ({
            productId: product.id,
            key: photoVariantKey(photo.name),
            name: photo.name,
            style: photoVariantStyle(photo.name),
            sortOrder: (index + 1) * 10,
          })),
        });
        await tx.productImage.createMany({
          data: [
            {
              productId: product.id,
              fileKey: generalKey,
              contentType: "image/jpeg",
              sizeBytes: bytesOf(0).byteLength,
              alt: photoAlt(product.name, set.photos[0].name),
              variant: null,
              sortOrder: 10,
            },
            ...set.photos.map((photo, index) => ({
              productId: product.id,
              fileKey: variantKeys[index],
              contentType: "image/jpeg",
              sizeBytes: bytesOf(index).byteLength,
              alt: photoAlt(product.name, photo.name),
              variant: photoVariantKey(photo.name),
              sortOrder: (index + 2) * 10,
            })),
          ],
        });
        await logAdminAction(tx, {
          actorId,
          action: "product.label_photos",
          resource: "Product",
          resourceId: product.id,
          changes: createdFields({
            variants: set.photos.map((photo) => photo.name).join(", "),
            photos: keys.length,
          }),
        });
        return true;
      });
    } catch (error) {
      await deleteFilesQuietly(keys);
      throw error;
    }
    if (!added) {
      await deleteFilesQuietly(keys);
      continue;
    }
    products += 1;
    photos += keys.length;
  }
  return { ok: true, products, photos };
}
