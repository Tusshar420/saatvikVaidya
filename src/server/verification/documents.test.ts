import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { decideVerification, deleteUsers } from "@/server/admin/users";
import { placeholderEmailFor } from "@/server/auth/placeholder-email";
import type { Message } from "@/server/notify";
import { getStorage } from "@/server/storage";
import { captureMessages, resetAuthData, userTypeIds } from "../../../tests/setup/auth";
import {
  findViewableDocument,
  readProfessionalVerification,
  readVerificationReview,
  uploadDocument,
  verificationStateOf,
} from "./documents";

const pdf = new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);

let types: Record<string, number>;
let sent: Message[];

async function createUser(
  id: string,
  type: string,
  extra: {
    role?: "user" | "admin";
    verificationStatus?: "none" | "pending" | "approved" | "rejected";
    email?: string;
    phoneNumber?: string;
  } = {},
) {
  await db.user.create({
    data: {
      id,
      name: `Name ${id}`,
      email: extra.email ?? `${id}@example.test`,
      phoneNumber: extra.phoneNumber,
      userTypeId: types[type],
      role: extra.role ?? "user",
      verificationStatus:
        extra.verificationStatus ?? (type === "customer" ? "none" : "pending"),
      termsAcceptedAt: new Date(),
    },
  });
}

const upload = (userId: string, documentType: string, bytes = pdf, fileName = "doc.pdf") =>
  uploadDocument({ userId, documentType, fileName, bytes });

async function fileExists(key: string) {
  return (await getStorage().get(key)) !== null;
}

beforeEach(async () => {
  await resetAuthData(db);
  types = await userTypeIds(db);
  sent = captureMessages();
  await createUser("admin-1", "customer", { role: "admin", email: "admin@example.test" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("verificationStateOf", () => {
  it("follows the status, with pending split by whether documents are in", () => {
    const date = new Date();
    expect(verificationStateOf("none", null)).toBe("needed");
    expect(verificationStateOf("pending", null)).toBe("needed");
    expect(verificationStateOf("pending", date)).toBe("review");
    expect(verificationStateOf("approved", null)).toBe("approved");
    expect(verificationStateOf("rejected", date)).toBe("rejected");
  });
});

describe("uploadDocument", () => {
  it("a doctor's one certificate completes the set and goes to review", async () => {
    await createUser("doc", "doctor");
    const before = await readProfessionalVerification("doc");
    expect(before).toMatchObject({
      state: "needed",
      required: ["registration_certificate"],
      missing: ["registration_certificate"],
    });

    const result = await upload("doc", "registration_certificate", pdf, "My cert.pdf");
    expect(result).toMatchObject({
      ok: true,
      complete: true,
      document: { fileName: "My cert.pdf", contentType: "application/pdf" },
    });

    const after = await readProfessionalVerification("doc");
    expect(after?.state).toBe("review");
    expect(after?.submittedAt).toBeInstanceOf(Date);
    expect(after?.missing).toEqual([]);
    const row = await db.professionalDocument.findFirstOrThrow({ where: { userId: "doc" } });
    expect(row.sizeBytes).toBe(pdf.byteLength);
    expect(await fileExists(row.fileKey)).toBe(true);

    // The professional gets a confirmation; each admin a notification.
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({
      channel: "email",
      to: "doc@example.test",
      subject: "We've received your document",
    });
    expect(sent[1]).toMatchObject({ channel: "email", to: "admin@example.test" });
    expect(sent[1].text).toContain("/admin/approvals/detail/doc");
  });

  it("a pharmacy needs both the drug licence and GST before review", async () => {
    await createUser("pharm", "pharmacy");
    expect(await upload("pharm", "drug_licence", jpeg, "licence.jpg")).toMatchObject({
      ok: true,
      complete: false,
      document: { contentType: "image/jpeg", fileName: "licence.jpg" },
    });
    const half = await readProfessionalVerification("pharm");
    expect(half).toMatchObject({ state: "needed", missing: ["gst_certificate"] });
    expect(half?.submittedAt).toBeNull();

    expect(await upload("pharm", "gst_certificate")).toMatchObject({
      ok: true,
      complete: true,
    });
    expect((await readProfessionalVerification("pharm"))?.state).toBe("review");
  });

  it("replacing a document deletes the old file", async () => {
    await createUser("doc", "doctor");
    await upload("doc", "registration_certificate");
    const first = await db.professionalDocument.findFirstOrThrow({ where: { userId: "doc" } });
    await upload("doc", "registration_certificate", jpeg, "photo.jpg");
    const second = await db.professionalDocument.findFirstOrThrow({ where: { userId: "doc" } });
    expect(second.id).toBe(first.id);
    expect(second.fileKey).not.toBe(first.fileKey);
    expect(second.contentType).toBe("image/jpeg");
    expect(await fileExists(first.fileKey)).toBe(false);
    expect(await fileExists(second.fileKey)).toBe(true);
    expect(await db.professionalDocument.count()).toBe(1);
  });

  it("refuses documents the user type doesn't need", async () => {
    await createUser("doc", "doctor");
    expect(await upload("doc", "gst_certificate")).toEqual({
      ok: false,
      error: "documentType",
    });
    expect(await upload("doc", "not-a-type")).toEqual({
      ok: false,
      error: "documentType",
    });
  });

  it("refuses customers and verified professionals", async () => {
    await createUser("cust", "customer");
    expect(await upload("cust", "registration_certificate")).toEqual({
      ok: false,
      error: "notProfessional",
    });
    await createUser("done", "doctor", { verificationStatus: "approved" });
    expect(await upload("done", "registration_certificate")).toEqual({
      ok: false,
      error: "locked",
    });
    expect(await upload("missing-user", "registration_certificate")).toEqual({
      ok: false,
      error: "notProfessional",
    });
    expect(await db.professionalDocument.count()).toBe(0);
  });

  it("checks the real file type and size, and stores nothing on failure", async () => {
    await createUser("doc", "doctor");
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    expect(await upload("doc", "registration_certificate", html, "fake.pdf")).toEqual({
      ok: false,
      error: "fileType",
    });
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(pdf);
    expect(await upload("doc", "registration_certificate", big)).toEqual({
      ok: false,
      error: "tooLarge",
    });
    expect(await upload("doc", "registration_certificate", new Uint8Array())).toEqual({
      ok: false,
      error: "empty",
    });
    expect(await db.professionalDocument.count()).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("phone-only professionals get an SMS instead of an email", async () => {
    await createUser("phone", "doctor", {
      email: placeholderEmailFor("+919812345678"),
      phoneNumber: "+919812345678",
    });
    await upload("phone", "registration_certificate");
    expect(sent[0]).toMatchObject({ channel: "sms", to: "+919812345678" });
  });
});

describe("decisions", () => {
  it("reject with a reason, re-upload, then approve", async () => {
    await createUser("doc", "doctor");
    await upload("doc", "registration_certificate");
    sent.length = 0;

    await decideVerification(["doc"], "rejected", "The certificate is blurred.", "admin-1");
    const rejected = await readProfessionalVerification("doc");
    expect(rejected).toMatchObject({
      state: "rejected",
      rejection: { comment: "The certificate is blurred." },
    });
    expect(sent).toEqual([
      expect.objectContaining({
        channel: "email",
        to: "doc@example.test",
        subject: "We couldn't verify your documents",
      }),
    ]);
    expect(sent[0].text).toContain("The certificate is blurred.");

    // A corrected file sends it back for review.
    await upload("doc", "registration_certificate", jpeg, "clear.jpg");
    const resubmitted = await readProfessionalVerification("doc");
    expect(resubmitted).toMatchObject({ state: "review", rejection: null });

    sent.length = 0;
    await decideVerification(["doc"], "approved", null, "admin-1");
    const approved = await readVerificationReview("doc");
    expect(approved?.state).toBe("approved");
    expect(approved?.documents[0].verifiedAt).toBeInstanceOf(Date);
    expect(sent[0]).toMatchObject({ subject: "Your account is verified" });

    // Both decisions are in the history, newest first, with the admin.
    expect(approved?.history).toEqual([
      expect.objectContaining({ decision: "approved", comment: null, authorName: "Name admin-1" }),
      expect.objectContaining({
        decision: "rejected",
        comment: "The certificate is blurred.",
        authorName: "Name admin-1",
      }),
    ]);

    // Verified: documents can't be changed any more.
    expect(await upload("doc", "registration_certificate")).toEqual({
      ok: false,
      error: "locked",
    });
  });

  it("a rejection clears the verified mark on documents", async () => {
    await createUser("doc", "doctor");
    await upload("doc", "registration_certificate");
    await decideVerification(["doc"], "approved", null, "admin-1");
    await decideVerification(["doc"], "rejected", null, "admin-1");
    const doc = await db.professionalDocument.findFirstOrThrow({ where: { userId: "doc" } });
    expect(doc.verifiedAt).toBeNull();
    expect((await readProfessionalVerification("doc"))?.rejection).toEqual({ comment: null });
  });

  it("customers are skipped, with no history or messages", async () => {
    await createUser("cust", "customer");
    sent.length = 0;
    expect(await decideVerification(["cust"], "approved", "x", "admin-1")).toEqual({
      changed: 0,
      skipped: 1,
    });
    expect(await db.verificationComment.count()).toBe(0);
    expect(sent).toHaveLength(0);
    expect(await readProfessionalVerification("cust")).toBeNull();
  });
});

describe("findViewableDocument", () => {
  it("shows a document to its owner and admins only", async () => {
    await createUser("doc", "doctor");
    await createUser("other", "doctor");
    const result = await upload("doc", "registration_certificate");
    if (!result.ok) throw new Error("upload failed");
    const id = result.document.id;

    expect(await findViewableDocument(id, { id: "doc", role: "user" })).toMatchObject({
      contentType: "application/pdf",
    });
    expect(await findViewableDocument(id, { id: "admin-1", role: "admin" })).not.toBeNull();
    expect(await findViewableDocument(id, { id: "other", role: "user" })).toBeNull();
    expect(await findViewableDocument(id + 999, { id: "admin-1", role: "admin" })).toBeNull();
  });
});

describe("deleting users", () => {
  it("removes their uploaded files too", async () => {
    await createUser("doc", "doctor");
    await upload("doc", "registration_certificate");
    const { fileKey } = await db.professionalDocument.findFirstOrThrow({ where: { userId: "doc" } });
    await decideVerification(["doc"], "rejected", "no", "admin-1");

    expect(await deleteUsers(["doc"], "admin-1")).toEqual({ changed: 1, skipped: 0 });
    expect(await fileExists(fileKey)).toBe(false);
    expect(await db.professionalDocument.count()).toBe(0);
    expect(await db.verificationComment.count()).toBe(0);
  });
});
