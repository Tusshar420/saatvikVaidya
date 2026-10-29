import "server-only";
import { randomBytes } from "node:crypto";

// Rules for what goes into Storage: key names, and checking an upload's real
// type and size on the server. The browser's file name and content type are
// never trusted; the type comes from the file's first bytes.

/**
 * Lowercase path segments of letters, digits, "_" and "-", separated by "/",
 * with an optional extension, e.g. "documents/abc123/9f86d0.pdf". No "..",
 * no leading "/", no backslashes.
 */
const KEY_PATTERN = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*(?:\.[a-z0-9]{1,8})?$/;

export function isValidFileKey(key: string): boolean {
  return key.length <= 191 && KEY_PATTERN.test(key);
}

export class InvalidFileKeyError extends Error {
  constructor(key: string) {
    super(`Invalid storage key: ${JSON.stringify(key.slice(0, 80))}`);
    this.name = "InvalidFileKeyError";
  }
}

/**
 * A new, unguessable key: `<folder>/<owner>/<32 hex>.<ext>`. The owner id is
 * turned into a safe segment (Better Auth ids can hold capitals, "-" and "_").
 */
export function newFileKey(folder: string, owner: string, extension: string): string {
  const segment = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 64) || "x";
  const key = `${segment(folder)}/${segment(owner)}/${randomBytes(16).toString("hex")}.${extension}`;
  if (!isValidFileKey(key)) throw new InvalidFileKeyError(key);
  return key;
}

/**
 * Magic numbers of the file types uploads may be: byte runs at an offset
 * that must all match.
 */
const signatures: { type: string; parts: { at: number; bytes: number[] }[] }[] = [
  { type: "application/pdf", parts: [{ at: 0, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }] }, // %PDF-
  { type: "image/jpeg", parts: [{ at: 0, bytes: [0xff, 0xd8, 0xff] }] },
  {
    type: "image/png",
    parts: [{ at: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  },
  {
    // "RIFF" <size> "WEBP"
    type: "image/webp",
    parts: [
      { at: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { at: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    ],
  },
];

/** The file's real type from its first bytes, or null if it isn't one we know. */
export function detectFileType(bytes: Uint8Array): string | null {
  const match = signatures.find(({ parts }) =>
    parts.every(({ at, bytes: magic }) =>
      magic.every((byte, index) => bytes[at + index] === byte),
    ),
  );
  return match?.type ?? null;
}

export type UploadRules<T extends string> = {
  maxBytes: number;
  /** Allowed content type → storage extension. */
  types: Readonly<Record<T, string>>;
};

export type CheckedUpload<T extends string> =
  | { ok: true; contentType: T; extension: string }
  | { ok: false; error: "empty" | "tooLarge" | "fileType" };

/** Checks an upload's size and real type against `rules`. */
export function checkUpload<T extends string>(
  bytes: Uint8Array,
  rules: UploadRules<T>,
): CheckedUpload<T> {
  if (bytes.byteLength === 0) return { ok: false, error: "empty" };
  if (bytes.byteLength > rules.maxBytes) return { ok: false, error: "tooLarge" };
  const type = detectFileType(bytes);
  if (!type || !(type in rules.types)) return { ok: false, error: "fileType" };
  const contentType = type as T;
  return { ok: true, contentType, extension: rules.types[contentType] };
}

/**
 * A file name that is safe to store and show: no folders, no control or
 * quote characters, at most 120 characters, with the right extension.
 */
export function cleanFileName(name: string, extension: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    // Control characters and characters that break headers or markup.
    .replace(/[\u0000-\u001f\u007f"<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.[^.]*$/, "")
    .slice(0, 120 - extension.length - 1)
    .trim();
  return `${base || "document"}.${extension}`;
}

/** `inline` or `attachment`, with an ASCII fallback name and the real one. */
export function contentDisposition(
  type: "inline" | "attachment",
  fileName: string,
): string {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/[\\"]/g, "_");
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Reads a request body, refusing more than `maxBytes` without reading the
 * rest (so a huge upload can't fill memory). Null when it's too big.
 */
export async function readBodyWithLimit(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
