import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db } from "@/server/db";
import {
  callAuth,
  captureMessages,
  resetAuthData,
  userTypeIds,
} from "../../../tests/setup/auth";
import { upsertAdmin } from "./admin";

// next/headers and next/navigation only work inside a Next request, so the
// request cookie and redirect()/notFound() are stand-ins here.
const request = vi.hoisted(() => ({ cookie: "" }));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers(request.cookie ? { cookie: request.cookie } : {}),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

const { getSession, requireAdmin, requireUser } = await import("./session");

let types: Record<string, number>;

beforeEach(async () => {
  await resetAuthData(db);
  types = await userTypeIds(db);
  captureMessages();
  request.cookie = "";
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

async function signInAs(email: string, password: string): Promise<void> {
  const reply = await callAuth("/sign-in/email", { email, password });
  expect(reply.sessionCookie).not.toBeNull();
  request.cookie = reply.sessionCookie!;
}

async function customer(): Promise<void> {
  await callAuth("/sign-up/email", {
    name: "Session User",
    email: "session@example.com",
    password: "Guduchi-stem-11",
    userTypeId: types.doctor,
    termsAccepted: true,
  });
  await signInAs("session@example.com", "Guduchi-stem-11");
}

describe("session helpers", () => {
  it("getSession() is null when signed out and the user when signed in", async () => {
    expect(await getSession()).toBeNull();
    await customer();
    const session = await getSession();
    expect(session?.user).toMatchObject({
      email: "session@example.com",
      role: "user",
      verificationStatus: "pending",
      userTypeId: types.doctor,
    });
  });

  it("getSession() ignores a made-up cookie", async () => {
    request.cookie = "sv.session_token=forged.value";
    expect(await getSession()).toBeNull();
  });

  it("requireUser() redirects to sign-in when signed out, coming back after", async () => {
    await expect(requireUser()).rejects.toThrow(
      "redirect:/?auth=sign-in&next=%2Faccount",
    );
    await expect(requireUser("/orders?page=2")).rejects.toThrow(
      "redirect:/?auth=sign-in&next=%2Forders%3Fpage%3D2",
    );
    await customer();
    const session = await requireUser();
    expect(session.user.email).toBe("session@example.com");
  });

  it("requireAdmin() is a 404 for normal users and passes for admins", async () => {
    await expect(requireAdmin()).rejects.toThrow(
      "redirect:/?auth=sign-in&next=%2Fadmin",
    );
    await customer();
    await expect(requireAdmin()).rejects.toThrow("notFound");

    await upsertAdmin(db, {
      ADMIN_EMAIL: "boss@example.com",
      ADMIN_PASSWORD: "A-long-admin-passphrase-1",
    });
    await signInAs("boss@example.com", "A-long-admin-passphrase-1");
    // No pages before two-factor is set up.
    await expect(requireAdmin()).rejects.toThrow("redirect:/account/two-factor");
    // (The sign-in and setup steps are in two-factor.test.ts.)
    await db.user.update({
      where: { email: "boss@example.com" },
      data: { twoFactorEnabled: true },
    });
    const session = await requireAdmin();
    expect(session.user.role).toBe("admin");
  });

  it("a role change applies on the next request (no stale cookie cache)", async () => {
    await customer();
    await db.user.update({
      where: { email: "session@example.com" },
      data: { role: "admin", adminRole: "super", twoFactorEnabled: true },
    });
    expect((await requireAdmin()).user.role).toBe("admin");
  });
});
