// `pnpm db:seed:photos "<folder>" [--dry-run] [--replace]`: loads the client's
// label photos (src/server/seed/product-photos.ts) onto the catalogue.
//
// For each medicine in the list, every pack size with that name gets:
// - its Build Your Brand variants set to one per photo, named after the
//   label's colour, the default (file 1) first;
// - photo 1 as the shop photo (a general photo), and every photo as the
//   photo of its variant.
//
// The files are print artwork (CMYK, up to 4 MB). Each is converted to sRGB,
// which every browser shows correctly, and resized to at most 1600 px.
//
// Safe to repeat: a product that already has photos or its own variants is
// left alone, so admin edits are kept. --replace removes that product's
// photos and variants first. --dry-run only reports what would happen.
// Needs `pnpm db:seed:catalogue` first: products are found by name.
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { MAX_BRAND_VARIANTS } from "../src/lib/brand-theme";
import { MAX_PRODUCT_IMAGES, productImageUpload } from "../src/lib/catalogue";
import {
  photoAlt,
  photoSets,
  photoVariantKey,
  photoVariantStyle,
} from "../src/server/seed/product-photos";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
const storageDir = resolve(process.env.STORAGE_DIR?.trim() || "storage");

const args = process.argv.slice(2);
const folder = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry-run");
const replace = args.includes("--replace");
if (!folder) {
  console.error('Usage: pnpm db:seed:photos "<folder>" [--dry-run] [--replace]');
  process.exit(1);
}

// sharp comes with Next.js (it optimises images), so load Next's copy rather
// than adding a second one. Only the calls used here are typed.
type SharpImage = {
  rotate(): SharpImage;
  resize(options: { width: number; height: number; fit: "inside"; withoutEnlargement: boolean }): SharpImage;
  toColourspace(space: "srgb"): SharpImage;
  jpeg(options: { quality: number; mozjpeg: boolean }): SharpImage;
  toBuffer(): Promise<Buffer>;
};
const sharp = createRequire(createRequire(import.meta.url).resolve("next/package.json"))(
  "sharp",
) as (input: Buffer) => SharpImage;

const MAX_SIDE = 1600;

/** A web copy of a label: sRGB JPEG, at most MAX_SIDE px a side. */
async function webCopy(path: string): Promise<Buffer> {
  const bytes = await sharp(await readFile(path))
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .toColourspace("srgb")
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  if (bytes.byteLength > productImageUpload.maxBytes) {
    throw new Error(`${path} is still over ${productImageUpload.maxBytes} bytes after resizing.`);
  }
  return bytes;
}

/** Same layout and rules as src/server/storage (newFileKey, local disk). */
async function storeFile(productId: number, bytes: Buffer): Promise<string> {
  const key = `products/${productId}/${randomBytes(16).toString("hex")}.jpg`;
  const path = join(storageDir, key);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = join(dirname(path), `.upload-${randomBytes(8).toString("hex")}`);
  await writeFile(temporary, bytes, { mode: 0o600 });
  await rename(temporary, path);
  return key;
}

const removeFiles = (keys: string[]) =>
  Promise.all(keys.map((key) => rm(join(storageDir, key), { force: true })));

const db = new PrismaClient({ adapter: new PrismaMariaDb(url) });

async function main(): Promise<void> {
  const missingFiles = photoSets
    .flatMap((set) => set.photos.map((photo) => photo.file))
    .filter((file) => !existsSync(join(folder!, file)));
  if (missingFiles.length > 0) {
    throw new Error(`Not in ${folder}:\n  ${missingFiles.join("\n  ")}`);
  }

  const counts = { done: 0, kept: 0, missing: [] as string[], photos: 0 };
  for (const set of photoSets) {
    if (set.photos.length > MAX_BRAND_VARIANTS || set.photos.length + 1 > MAX_PRODUCT_IMAGES) {
      throw new Error(`Too many photos for ${set.products.join(", ")}.`);
    }
    const products = await db.product.findMany({
      // Real products only: the seeded samples share some names.
      where: { name: { in: [...set.products] }, isSample: false },
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        packSize: true,
        images: { select: { fileKey: true } },
        _count: { select: { variants: true } },
      },
    });
    for (const name of set.products) {
      if (!products.some((product) => product.name === name)) counts.missing.push(name);
    }
    if (products.length === 0) continue;

    // Converted once per medicine, then stored for each pack size.
    const copies = dryRun
      ? []
      : await Promise.all(set.photos.map((photo) => webCopy(join(folder!, photo.file))));

    for (const product of products) {
      const label = `${product.name} (${product.packSize})`;
      const hasOwn = product.images.length > 0 || product._count.variants > 0;
      if (hasOwn && !replace) {
        console.info(`Kept   ${label}: already has photos or variants (use --replace).`);
        counts.kept += 1;
        continue;
      }
      const names = set.photos.map((photo) => photo.name);
      console.info(`${dryRun ? "Would " : ""}Add    ${label}: ${names.join(", ")}`);
      if (dryRun) {
        counts.done += 1;
        continue;
      }

      // Files first; if the database step fails they're removed again.
      const variantKeys: string[] = [];
      for (let index = 0; index < copies.length; index++) {
        variantKeys.push(await storeFile(product.id, copies[index]));
      }
      const generalKey = await storeFile(product.id, copies[0]);
      const newKeys = [generalKey, ...variantKeys];
      try {
        await db.$transaction(async (tx) => {
          await tx.productImage.deleteMany({ where: { productId: product.id } });
          await tx.productVariant.deleteMany({ where: { productId: product.id } });
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
                sizeBytes: copies[0].byteLength,
                alt: photoAlt(product.name, set.photos[0].name),
                variant: null,
                sortOrder: 10,
              },
              ...set.photos.map((photo, index) => ({
                productId: product.id,
                fileKey: variantKeys[index],
                contentType: "image/jpeg",
                sizeBytes: copies[index].byteLength,
                alt: photoAlt(product.name, photo.name),
                variant: photoVariantKey(photo.name),
                sortOrder: (index + 2) * 10,
              })),
            ],
          });
        });
      } catch (error) {
        await removeFiles(newKeys);
        throw error;
      }
      // Photos replaced with --replace: their files go once the rows are gone.
      await removeFiles(product.images.map((image) => image.fileKey));
      counts.done += 1;
      counts.photos += newKeys.length;
    }
  }

  console.info(
    `\nPhotos: ${counts.done} products ${dryRun ? "would be " : ""}updated` +
      (dryRun ? "" : ` (${counts.photos} photos stored)`) +
      `, ${counts.kept} kept as they were.`,
  );
  if (counts.missing.length > 0) {
    console.warn(
      `Not in the catalogue (run pnpm db:seed:catalogue first?):\n  ${counts.missing.join("\n  ")}`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
