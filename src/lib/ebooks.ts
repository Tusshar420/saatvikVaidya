// Ebook rules shared by the server, the admin forms and the pages (P1.8):
// upload limits, the SAC code and links. Labels live in src/content/ebooks.ts
// and src/content/admin.ts.

/** SAC for online books and other text content supplied digitally. */
export const EBOOK_SAC_CODE = "998431";

/** The book itself: PDF only, checked from the file's first bytes. */
export const ebookFileUpload = {
  maxBytes: 50 * 1024 * 1024,
  types: { "application/pdf": "pdf" },
  accept: ".pdf,application/pdf",
} as const;

/** Cover images, checked from the file's first bytes. */
export const ebookCoverUpload = {
  maxBytes: 5 * 1024 * 1024,
  types: {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  },
  accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp",
} as const;

export const ebookHref = (slug: string) => `/ebooks/${slug}`;

/**
 * Where a cover is served from. The `v` part changes with each new upload
 * (the key is random), so a cached old cover is never shown.
 */
export const ebookCoverSrc = (id: number, coverKey: string) =>
  `/api/ebook-covers/${id}?v=${coverKey.slice(-12, -4)}`;

export const ebookDownloadHref = (id: number) => `/api/ebooks/${id}/download`;
