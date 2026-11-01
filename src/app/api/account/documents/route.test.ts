import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { rateLimitRules } from "@/server/auth/policy";
import { captureMessages, resetAuthData, userTypeIds } from "../../../../../tests/setup/auth";

// The upload route and the file route, with the session mocked: getSession()
// returns whoever `signedIn` is (or null when signed out).

const session = vi.hoisted(() => ({
  user: null as null | { id: string; role: "user" | "admin" },
}));
vi.mock("@/server/auth/session", () => ({
  getSession: vi.fn(async () => (session.user ? { user: session.user } : null)),
  // The real checks (role area, two-factor) are tested in session.test.ts;
  // here an admin is just a user with role "admin".
  getAdminSession: vi.fn(async () =>
    session.user?.role === "admin" ? { user: session.user } : null,
  ),
  effectiveRole: (current: { user: { role: string } } | null) =>
    current?.user.role === "admin" ? "admin" : "user",
}));

const { POST } = await import("./route");
const { GET } = await import("../../documents/[id]/route");

const origin = "http://localhost:3000";
const pdf = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

function uploadRequest(
  fields: { documentType?: string; file?: File },
  headers: Record<string, string> = { origin },
): Request {
  const form = new FormData();
  if (fields.documentType) form.append("documentType", fields.documentType);
  if (fields.file) form.append("file", fields.file);
  return new Request(`${origin}/api/account/documents`, {
    method: "POST",
    body: form,
    headers,
  });
}

const certificate = (bytes: Uint8Array = pdf, name = "cert.pdf", type = "application/pdf") => ({
  documentType: "registration_certificate",
  file: new File([bytes as Uint8Array<ArrayBuffer>], name, { type }),
});

function getFile(id: number | string, query = "") {
  return GET(new Request(`${origin}/api/documents/${id}${query}`), {
    params: Promise.resolve({ id: String(id) }),
  });
}

let types: Record<string, number>;

async function createUser(id: string, type: string, role: "user" | "admin" = "user") {
  await db.user.create({
    data: {
      id,
      name: id,
      email: `${id}@example.test`,
      userTypeId: types[type],
      role,
      verificationStatus: type === "customer" ? "none" : "pending",
      termsAcceptedAt: new Date(),
    },
  });
}

beforeEach(async () => {
  await resetAuthData(db);
  types = await userTypeIds(db);
  captureMessages();
  session.user = null;
  await createUser("doc", "doctor");
  await createUser("other", "doctor");
  await createUser("cust", "customer");
  await createUser("admin", "customer", "admin");
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("POST /api/account/documents", () => {
  it("refuses cross-site and signed-out requests", async () => {
    session.user = { id: "doc", role: "user" };
    const cross = await POST(uploadRequest(certificate(), { origin: "https://evil.example" }));
    expect(cross.status).toBe(403);
    const noOrigin = await POST(uploadRequest(certificate(), {}));
    expect(noOrigin.status).toBe(403);

    session.user = null;
    const signedOut = await POST(uploadRequest(certificate()));
    expect(signedOut.status).toBe(401);
    expect(await signedOut.json()).toMatchObject({ ok: false, error: "signedOut" });
    expect(await db.professionalDocument.count()).toBe(0);
  });

  it("saves a professional's PDF and reports the set complete", async () => {
    session.user = { id: "doc", role: "user" };
    const first = await POST(uploadRequest(certificate()));
    expect(await first.json()).toEqual({ ok: true, complete: false });
    const response = await POST(
      uploadRequest({ ...certificate(), documentType: "degree_certificate" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, complete: true });
    const user = await db.user.findUniqueOrThrow({ where: { id: "doc" } });
    expect(user.verificationSubmittedAt).toBeInstanceOf(Date);
  });

  it("accepts images, and refuses other types by their content", async () => {
    session.user = { id: "doc", role: "user" };
    expect((await POST(uploadRequest(certificate(png, "scan.png", "image/png")))).status).toBe(200);
    // Claims to be a PDF, but isn't.
    const fake = await POST(
      uploadRequest(certificate(new TextEncoder().encode("MZ\x90\x00"), "x.pdf")),
    );
    expect(fake.status).toBe(415);
    expect(await fake.json()).toMatchObject({
      error: "fileType",
      message: "Please upload a PDF, JPG or PNG file.",
    });
  });

  it("refuses files over 5 MB before storing anything", async () => {
    session.user = { id: "doc", role: "user" };
    const big = new Uint8Array(5 * 1024 * 1024 + 100);
    big.set(pdf);
    const response = await POST(uploadRequest(certificate(big)));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: "tooLarge" });

    const declared = await POST(
      new Request(`${origin}/api/account/documents`, {
        method: "POST",
        body: "x",
        headers: { origin, "content-length": String(50 * 1024 * 1024) },
      }),
    );
    expect(declared.status).toBe(413);
    expect(await db.professionalDocument.count()).toBe(0);
  });

  it("refuses customers, wrong document types and malformed forms", async () => {
    session.user = { id: "cust", role: "user" };
    expect((await POST(uploadRequest(certificate()))).status).toBe(403);

    session.user = { id: "doc", role: "user" };
    const wrongType = await POST(
      uploadRequest({ ...certificate(), documentType: "gst_certificate" }),
    );
    expect(wrongType.status).toBe(400);
    expect(await wrongType.json()).toMatchObject({ error: "documentType" });
    expect((await POST(uploadRequest({ documentType: "registration_certificate" }))).status).toBe(400);
    const notMultipart = await POST(
      new Request(`${origin}/api/account/documents`, {
        method: "POST",
        body: "{}",
        headers: { origin, "content-type": "application/json" },
      }),
    );
    expect(notMultipart.status).toBe(400);
  });

  it("rate-limits uploads per account", async () => {
    session.user = { id: "doc", role: "user" };
    const rule = rateLimitRules.documentUploadPerUser;
    await db.authRateLimit.create({
      data: {
        key: `${rule.name}:doc`,
        count: rule.max,
        resetAtMs: BigInt(Date.now() + 60_000),
      },
    });
    const response = await POST(uploadRequest(certificate()));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
  });
});

describe("GET /api/documents/[id]", () => {
  async function uploaded() {
    session.user = { id: "doc", role: "user" };
    await POST(uploadRequest(certificate(pdf, "Registration रजि.pdf")));
    const row = await db.professionalDocument.findFirstOrThrow({ where: { userId: "doc" } });
    return row.id;
  }

  it("serves the file to its owner, inline, never cached", async () => {
    const id = await uploaded();
    const response = await getFile(id);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-length")).toBe(String(pdf.byteLength));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toMatch(/^inline; filename="Registration ___.pdf"/);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pdf);
  });

  it("serves admins, as a download when asked", async () => {
    const id = await uploaded();
    session.user = { id: "admin", role: "admin" };
    const response = await getFile(id, "?download=1");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/^attachment;/);
  });

  it("gives everyone else the same 404", async () => {
    const id = await uploaded();
    session.user = { id: "other", role: "user" };
    expect((await getFile(id)).status).toBe(404);
    session.user = null;
    expect((await getFile(id)).status).toBe(404);
    session.user = { id: "admin", role: "admin" };
    expect((await getFile(id + 1000)).status).toBe(404);
    expect((await getFile("abc")).status).toBe(404);
    expect((await getFile("-1")).status).toBe(404);
  });
});
