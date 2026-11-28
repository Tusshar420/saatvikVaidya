import "server-only";
import { readFile, stat } from "node:fs/promises";
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

/** The web copies, read and checked (JPEG, size), keyed by client file name. */
async function readPhotos(
  folder: string,
  photos: readonly { file: string }[],
): Promise<{ ok: true; files: Map<string, Uint8Array> } | { ok: false; error: "missing"; file: string }> {
  const files = new Map<string, Uint8Array>();
  for (const photo of photos) {
    if (files.has(photo.file)) continue;
    const name = preparedFileName(photo.file);
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await readFile(join(folder, name)));
    } catch {
      return { ok: false, error: "missing", file: name };
    }
    const checked = checkUpload(bytes, productImageUpload);
    if (!checked.ok || checked.contentType !== "image/jpeg") return { ok: false, error: "missing", file: name };
    files.set(photo.file, bytes);
  }
  return { ok: true, files };
}

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

/**
 * How many products would get photos (and how many photos in all), and how
 * many still have older copies of their label photos that "Update" replaces.
 */
export async function labelPhotoStatus(options: Options = {}) {
  const sets = options.sets ?? photoSets;
  const folder = resolve(options.folder ?? LABEL_PHOTOS_DIR);
  const [ready, outdated] = await Promise.all([readyProducts(sets), outdatedProducts(sets, folder)]);
  return {
    products: ready.length,
    photos: ready.reduce((sum, product) => sum + product.set.photos.length + 1, 0),
    outdated: outdated.length,
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
  const read = await readPhotos(folder, ready.flatMap((product) => product.set.photos));
  if (!read.ok) return read;
  const files = read.files;

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
        // Lock the product row, then check again: an admin may have just
        // added a photo or variants, or pressed the button twice at once.
        await tx.$queryRaw`SELECT id FROM Product WHERE id = ${product.id} FOR UPDATE`;
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

// ─── Updating older copies ──────────────────────────────────────────────────
// The first copies (deployed 2026-11-28) kept the white margin around each
// label, so a short card showed it tiny. "Update label photos" swaps them for
// the current copies. Only products whose label photos are exactly as the
// loader left them are touched: the same variants in order, and one shop
// photo plus one photo per variant with the loader's descriptions. New photo
// rows are made (new ids), because photos are cached by id for a day.

type Outdated = Ready & { images: { id: number; fileKey: string }[] };

async function outdatedProducts(sets: readonly PhotoSet[], folder: string): Promise<Outdated[]> {
  const names = sets.flatMap((set) => set.products);
  const rows = await db.product.findMany({
    where: { name: { in: names }, isSample: false, images: { some: {} } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      variants: { orderBy: [{ sortOrder: "asc" }, { key: "asc" }], select: { key: true, name: true } },
      images: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, fileKey: true, sizeBytes: true, variant: true, alt: true },
      },
    },
  });
  const sizes = new Map<string, number | null>();
  const sizeOf = async (file: string) => {
    if (!sizes.has(file)) {
      sizes.set(file, await stat(join(folder, preparedFileName(file))).then((s) => s.size, () => null));
    }
    return sizes.get(file)!;
  };
  const outdated: Outdated[] = [];
  for (const row of rows) {
    const set = sets.find((candidate) => candidate.products.includes(row.name))!;
    const expected = [
      { variant: null, alt: photoAlt(row.name, set.photos[0].name), file: set.photos[0].file },
      ...set.photos.map((photo) => ({
        variant: photoVariantKey(photo.name) as string | null,
        alt: photoAlt(row.name, photo.name),
        file: photo.file,
      })),
    ];
    const sameVariants =
      row.variants.length === set.photos.length &&
      row.variants.every(
        (variant, index) =>
          variant.key === photoVariantKey(set.photos[index].name) && variant.name === set.photos[index].name,
      );
    const sameImages =
      row.images.length === expected.length &&
      row.images.every(
        (image, index) => image.variant === expected[index].variant && image.alt === expected[index].alt,
      );
    if (!sameVariants || !sameImages) continue;
    let differs = false;
    for (let index = 0; index < expected.length; index++) {
      const size = await sizeOf(expected[index].file);
      if (size !== null && size !== row.images[index].sizeBytes) differs = true;
    }
    if (differs) {
      outdated.push({ id: row.id, name: row.name, set, images: row.images.map(({ id, fileKey }) => ({ id, fileKey })) });
    }
  }
  return outdated;
}

/** Replaces older copies of the label photos; see the note above. */
export async function updateLabelPhotos(actorId: string, options: Options = {}): Promise<LabelPhotoResult> {
  const folder = resolve(options.folder ?? LABEL_PHOTOS_DIR);
  const outdated = await outdatedProducts(options.sets ?? photoSets, folder);
  const read = await readPhotos(folder, outdated.flatMap((product) => product.set.photos));
  if (!read.ok) return read;
  const files = read.files;

  let products = 0;
  let photos = 0;
  for (const product of outdated) {
    const { set } = product;
    const bytesOf = (index: number) => files.get(set.photos[index].file)!;
    const generalKey = newFileKey("products", String(product.id), "jpg");
    const variantKeys = set.photos.map(() => newFileKey("products", String(product.id), "jpg"));
    const keys = [generalKey, ...variantKeys];
    await getStorage().put(generalKey, bytesOf(0));
    for (let index = 0; index < variantKeys.length; index++) {
      await getStorage().put(variantKeys[index], bytesOf(index));
    }
    let replaced: boolean;
    try {
      replaced = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM Product WHERE id = ${product.id} FOR UPDATE`;
        // Still the same photos? An admin may have changed them meanwhile.
        const now = await tx.productImage.findMany({
          where: { productId: product.id },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        const same =
          now.length === product.images.length && now.every((image, index) => image.id === product.images[index].id);
        if (!same) return false;
        await tx.productImage.deleteMany({ where: { id: { in: product.images.map((image) => image.id) } } });
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
          changes: createdFields({ photos: keys.length }),
          note: "Replaced older copies of the label photos",
        });
        return true;
      });
    } catch (error) {
      await deleteFilesQuietly(keys);
      throw error;
    }
    if (!replaced) {
      await deleteFilesQuietly(keys);
      continue;
    }
    await deleteFilesQuietly(product.images.map((image) => image.fileKey));
    products += 1;
    photos += keys.length;
  }
  return { ok: true, products, photos };
}
