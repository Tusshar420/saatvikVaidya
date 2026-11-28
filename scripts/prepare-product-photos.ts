// `pnpm photos:prepare "<folder>"`: makes web copies of the client's label
// photos (src/server/seed/product-photos.ts) in prisma/product-photos/, which
// is committed. On the site, an admin then loads them onto the products with
// "Load label photos" on /admin/catalogue/photos (src/server/admin/label-photos.ts).
//
// The client's files are print artwork (CMYK, 1.5–4 MB). Each copy is sRGB,
// which every browser shows correctly, trimmed of the white margins around the
// label, at most 1200 px a side (about 80 KB).
// Run on a developer's computer only; the server never needs sharp.
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { productImageUpload } from "../src/lib/catalogue";
import { LABEL_PHOTOS_DIR, photoSets, preparedFileName } from "../src/server/seed/product-photos";

const folder = process.argv[2];
if (!folder) {
  console.error('Usage: pnpm photos:prepare "<folder with the client\'s files>"');
  process.exit(1);
}

// sharp comes with Next.js (it optimises images), so load Next's copy rather
// than adding a second one. Only the calls used here are typed.
type SharpImage = {
  rotate(): SharpImage;
  trim(options: { threshold: number }): SharpImage;
  resize(options: { width: number; height: number; fit: "inside"; withoutEnlargement: boolean }): SharpImage;
  toColourspace(space: "srgb"): SharpImage;
  jpeg(options: { quality: number; mozjpeg: boolean }): SharpImage;
  toBuffer(): Promise<Buffer>;
};
const sharp = createRequire(createRequire(import.meta.url).resolve("next/package.json"))(
  "sharp",
) as (input: Buffer) => SharpImage;

const MAX_SIDE = 1200;

async function main(): Promise<void> {
  const files = photoSets.flatMap((set) => set.photos.map((photo) => photo.file));
  const missing = files.filter((file) => !existsSync(join(folder!, file)));
  if (missing.length > 0) throw new Error(`Not in ${folder}:\n  ${missing.join("\n  ")}`);

  // Start clean so a photo dropped from the list doesn't linger.
  await mkdir(LABEL_PHOTOS_DIR, { recursive: true });
  for (const old of await readdir(LABEL_PHOTOS_DIR)) {
    if (old.endsWith(".jpg")) await rm(join(LABEL_PHOTOS_DIR, old));
  }

  let total = 0;
  for (const file of files) {
    const bytes = await sharp(await readFile(join(folder!, file)))
      .rotate()
      // The labels sit in the middle of a white square; cut the white away
      // so a short, wide card shows the label at full size.
      .trim({ threshold: 12 })
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    if (bytes.byteLength > productImageUpload.maxBytes) throw new Error(`${file} is too large.`);
    await writeFile(join(LABEL_PHOTOS_DIR, preparedFileName(file)), bytes);
    total += bytes.byteLength;
  }
  console.info(
    `${files.length} photos written to ${LABEL_PHOTOS_DIR} (${Math.round(total / 1024 / 1024)} MB).`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
