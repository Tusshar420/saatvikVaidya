// "Load label photos" on /admin/catalogue/photos (src/server/admin/label-photos.ts).

export const labelPhotos = {
  title: "Client label photos",
  ready: (products: number, photos: number) =>
    `${products} ${products === 1 ? "product is" : "products are"} ready for their label photos (${photos} photos). Each gets one Build Your Brand variant per label colour, and label 1 as its shop photo.`,
  none: "All label photos are loaded. Products that already had photos or their own variants were left as they were.",
  button: "Load label photos",
  pending: "Loading photos…",
  loaded: (products: number, photos: number) =>
    `Label photos loaded: ${products} ${products === 1 ? "product" : "products"}, ${photos} photos.`,
  missing: (file: string) =>
    `The photo file ${file} is missing from this version of the site, so nothing was changed.`,
} as const;
