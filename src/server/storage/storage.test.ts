import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  checkUpload,
  cleanFileName,
  contentDisposition,
  detectFileType,
  isValidFileKey,
  newFileKey,
  readBodyWithLimit,
} from "./files";
import { createLocalDiskStorage } from "./local-disk";
import type { Storage } from "./index";

const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

const rules = {
  maxBytes: 64,
  types: { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" },
} as const;

async function text(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

describe("file checks", () => {
  it("detects PDF, JPEG and PNG from their first bytes", () => {
    expect(detectFileType(pdf)).toBe("application/pdf");
    expect(detectFileType(jpeg)).toBe("image/jpeg");
    expect(detectFileType(png)).toBe("image/png");
    expect(detectFileType(new TextEncoder().encode("<svg></svg>"))).toBeNull();
    expect(detectFileType(new Uint8Array([0x4d, 0x5a, 0x90]))).toBeNull(); // .exe
  });

  it("accepts allowed types within the size limit, whatever the name says", () => {
    expect(checkUpload(pdf, rules)).toEqual({
      ok: true,
      contentType: "application/pdf",
      extension: "pdf",
    });
    expect(checkUpload(jpeg, rules)).toMatchObject({ ok: true, extension: "jpg" });
  });

  it("refuses empty, too large and unknown files", () => {
    expect(checkUpload(new Uint8Array(), rules)).toEqual({ ok: false, error: "empty" });
    const big = new Uint8Array(65);
    big.set(pdf.slice(0, 5));
    expect(checkUpload(big, rules)).toEqual({ ok: false, error: "tooLarge" });
    expect(checkUpload(new TextEncoder().encode("<html>"), rules)).toEqual({
      ok: false,
      error: "fileType",
    });
    // A PNG where only PDFs are allowed.
    expect(
      checkUpload(png, { maxBytes: 64, types: { "application/pdf": "pdf" } }),
    ).toEqual({ ok: false, error: "fileType" });
  });

  it("cleans file names for storage and display", () => {
    expect(cleanFileName("C:\\Users\\me\\GST cert.PDF", "pdf")).toBe("GST cert.pdf");
    expect(cleanFileName("../../etc/passwd", "pdf")).toBe("passwd.pdf");
    expect(cleanFileName('bad"<name>\u0007.jpg', "jpg")).toBe("badname.jpg");
    expect(cleanFileName("", "png")).toBe("document.png");
    expect(cleanFileName(`${"a".repeat(300)}.pdf`, "pdf")).toHaveLength(120);
    // The stored extension always matches the real type.
    expect(cleanFileName("licence.exe", "pdf")).toBe("licence.pdf");
  });

  it("makes unguessable keys that pass the key rules", () => {
    const one = newFileKey("documents", "AbC_12-x/..", "pdf");
    const two = newFileKey("documents", "AbC_12-x/..", "pdf");
    expect(one).not.toBe(two);
    expect(one).toMatch(/^documents\/abc_12-x---\/[0-9a-f]{32}\.pdf$/);
    expect(isValidFileKey(one)).toBe(true);
  });

  it("rejects keys that could leave the storage folder", () => {
    for (const key of [
      "../secret",
      "/etc/passwd",
      "documents/../../x.pdf",
      "documents\\x.pdf",
      "Documents/x.pdf",
      "documents//x.pdf",
      "",
    ]) {
      expect(isValidFileKey(key), key).toBe(false);
    }
  });

  it("writes Content-Disposition with a safe fallback name", () => {
    expect(contentDisposition("attachment", 'Licence "रजि".pdf')).toBe(
      `attachment; filename="Licence _____.pdf"; filename*=UTF-8''Licence%20%22%E0%A4%B0%E0%A4%9C%E0%A4%BF%22.pdf`,
    );
  });

  it("stops reading a body that is over the limit", async () => {
    const small = new Request("http://x.test", { method: "POST", body: "hello" });
    expect(new TextDecoder().decode((await readBodyWithLimit(small, 10))!)).toBe(
      "hello",
    );
    const declared = new Request("http://x.test", {
      method: "POST",
      body: "x",
      headers: { "content-length": "999999" },
    });
    expect(await readBodyWithLimit(declared, 10)).toBeNull();
    // No Content-Length (streamed): counted while reading.
    const streamed = new Request("http://x.test", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          for (let i = 0; i < 5; i++) controller.enqueue(new Uint8Array(4));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit);
    expect(await readBodyWithLimit(streamed, 10)).toBeNull();
  });
});

describe("local disk storage", () => {
  let root: string;
  let storage: Storage;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "sv-storage-"));
    storage = createLocalDiskStorage(root);
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("saves, reads, replaces and deletes a file", async () => {
    const key = "documents/user-1/abc.pdf";
    await storage.put(key, new TextEncoder().encode("first"));
    await storage.put(key, new TextEncoder().encode("second"));
    const file = await storage.get(key);
    expect(file?.size).toBe(6);
    expect(await text(file!.body)).toBe("second");
    // No temporary files left behind.
    expect(await readdir(join(root, "documents/user-1"))).toEqual(["abc.pdf"]);

    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });

  it("returns null for a missing file", async () => {
    expect(await storage.get("documents/nobody/missing.pdf")).toBeNull();
  });

  it("refuses keys outside the folder", async () => {
    await expect(storage.put("../escape.pdf", pdf)).rejects.toThrow(/Invalid storage key/);
    await expect(storage.get("/etc/passwd")).rejects.toThrow(/Invalid storage key/);
    await expect(storage.delete("a/../../b")).rejects.toThrow(/Invalid storage key/);
  });
});
