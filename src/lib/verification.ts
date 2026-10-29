// Professional verification rules shared by the server and the upload form:
// which documents each user type must upload, and which files are accepted.
// Labels and help text live in src/content/verification.ts.

export const documentTypes = [
  "registration_certificate",
  "clinic_registration",
  "drug_licence",
  "gst_certificate",
] as const;

export type DocumentType = (typeof documentTypes)[number];

export function isDocumentType(value: unknown): value is DocumentType {
  return documentTypes.includes(value as DocumentType);
}

/** Required documents per user type key, from docs/CHUNKS.md (P1.2). */
const requiredByUserType: Record<string, readonly DocumentType[]> = {
  doctor: ["registration_certificate"],
  clinic: ["clinic_registration", "gst_certificate"],
  pharmacy: ["drug_licence", "gst_certificate"],
  stockist: ["drug_licence", "gst_certificate"],
};

/**
 * What a professional of this type must upload. A type added later without
 * its own list (user types are data) asks for a registration certificate.
 */
export function requiredDocumentsFor(userTypeKey: string): readonly DocumentType[] {
  return requiredByUserType[userTypeKey] ?? ["registration_certificate"];
}

/** Accepted files: the type is checked from the file's first bytes on the server. */
export const documentUpload = {
  maxBytes: 5 * 1024 * 1024,
  /** Content type → file extension used in storage. */
  types: {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
  },
  /** For the file input's `accept` attribute (a hint only). */
  accept: ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png",
} as const;

export type DocumentContentType = keyof typeof documentUpload.types;

export function isDocumentContentType(
  value: unknown,
): value is DocumentContentType {
  return typeof value === "string" && value in documentUpload.types;
}

/** "1.2 MB", "340 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toLocaleString("en-IN", { maximumFractionDigits: 1 })} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("en-IN")} KB`;
}
