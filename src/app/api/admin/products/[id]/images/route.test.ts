import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { productImageUpload } from "@/lib/catalogue";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { clearContentTables } from "../../../../../../../tests/setup/content-db";

// The admin image upload route and the public image route, with the session
// mocked (getSession() returns `session.user`, or null when signed out).
// revalidatePath needs Next's request store, so it's stubbed.

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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { POST } = await import("./route");
const { GET } = await import("../../../../product-images/[id]/route");

const origin = "http://localhost:3000";
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const admin = { id: "route-admin", role: "admin" as const };

let productId: number;

function upload(
  id: number | string,
  fields: { file?: Uint8Array; alt?: string; name?: string },
  headers: Record<string, string> = { origin },
) {
  const form = new FormData();
  if (fields.file) {
    form.append(
      "file",
      new File([fields.file as Uint8Array<ArrayBuffer>], fields.name ?? "pack.png", {
        type: "image/png",
      }),
    );
  }
  if (fields.alt !== undefined) form.append("alt", fields.alt);
  return POST(
    new Request(`${origin}/api/admin/products/${id}/images`, {
      method: "POST",
      body: form,
      headers,
    }),
    { params: Promise.resolve({ id: String(id) }) },
  );
}

function image(id: number | string) {
  return GET(new Request(`${origin}/api/product-images/${id}`), {
    params: Promise.resolve({ id: String(id) }),
  });
}

beforeEach(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
  const customer = await db.userType.findUniqueOrThrow({ where: { key: "customer" } });
  for (const user of [admin, { id: "route-user", role: "user" as const }]) {
    await db.user.create({
      data: {
        ...user,
        name: user.id,
        email: `${user.id}@example.test`,
        userTypeId: customer.id,
        termsAcceptedAt: new Date(),
      },
    });
  }
  productId = (await db.product.findUniqueOrThrow({ where: { slug: "chyawanprash" } })).id;
  session.user = admin;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("POST /api/admin/products/[id]/images", () => {
  it("adds a photo for an admin, which anyone can then load", async () => {
    const response = await upload(productId, { file: png, alt: "Jar front" });
    expect(response.status).toBe(200);
    const reply = (await response.json()) as { ok: boolean; id: number };
    expect(reply.ok).toBe(true);

    session.user = null;
    const served = await image(reply.id);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(served.headers.get("cache-control")).toMatch(/^public/);
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(png);
  });

  it("is a 404 for visitors and non-admins, and refuses cross-site requests", async () => {
    session.user = null;
    expect((await upload(productId, { file: png, alt: "x" })).status).toBe(404);
    session.user = { id: "route-user", role: "user" };
    expect((await upload(productId, { file: png, alt: "x" })).status).toBe(404);
    session.user = admin;
    expect(
      (await upload(productId, { file: png, alt: "x" }, { origin: "https://evil.example" }))
        .status,
    ).toBe(403);
    expect((await upload(productId, { file: png, alt: "x" }, {})).status).toBe(403);
    expect(await db.productImage.count()).toBe(0);
  });

  it("checks the file, the description, the size and the product", async () => {
    const status = async (...args: Parameters<typeof upload>) => (await upload(...args)).status;
    expect(await status(productId, { alt: "No file" })).toBe(400);
    expect(await status(productId, { file: png, alt: " " })).toBe(400);
    expect(
      await status(productId, { file: new TextEncoder().encode("<svg/>"), alt: "Fake", name: "a.png" }),
    ).toBe(415);
    const big = new Uint8Array(productImageUpload.maxBytes + 1);
    big.set(png);
    expect(await status(productId, { file: big, alt: "Huge" })).toBe(413);
    expect(await status(999_999, { file: png, alt: "Gone" })).toBe(404);
    expect(await status("abc", { file: png, alt: "Bad id" })).toBe(404);
    expect(await db.productImage.count()).toBe(0);
  });
});

describe("GET /api/product-images/[id]", () => {
  it("serves a hidden product's photo to admins only", async () => {
    const reply = (await (await upload(productId, { file: png, alt: "Jar" })).json()) as {
      id: number;
    };
    await db.product.update({ where: { id: productId }, data: { active: false } });

    session.user = null;
    expect((await image(reply.id)).status).toBe(404);
    session.user = { id: "route-user", role: "user" };
    expect((await image(reply.id)).status).toBe(404);
    session.user = admin;
    const served = await image(reply.id);
    expect(served.status).toBe(200);
    expect(served.headers.get("cache-control")).toBe("private, no-store");
    expect((await image("999999")).status).toBe(404);
    expect((await image("../x")).status).toBe(404);
  });
});
