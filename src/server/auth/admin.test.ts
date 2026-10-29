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
} from "../../../tests/setup/auth";
import { upsertAdmin } from "./admin";

beforeEach(async () => {
  await resetAuthData(db);
  captureMessages();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

const admin = {
  ADMIN_EMAIL: "Admin@Example.com",
  ADMIN_PASSWORD: "Chyawanprash-jar-2026",
};

describe("pnpm admin:create", () => {
  it("creates an admin who can sign in", async () => {
    const result = await upsertAdmin(db, admin);
    expect(result).toMatchObject({ email: "admin@example.com", created: true });
    const user = await db.user.findUniqueOrThrow({
      where: { email: "admin@example.com" },
      include: { userType: true },
    });
    expect(user).toMatchObject({
      role: "admin",
      name: "Saatvik Vaidya Admin",
      emailVerified: true,
      verificationStatus: "none",
    });
    expect(user.userType.key).toBe("customer");

    const signIn = await callAuth("/sign-in/email", {
      email: "admin@example.com",
      password: admin.ADMIN_PASSWORD,
    });
    expect(signIn.status).toBe(200);
  });

  it("updates the password on a second run and signs the admin out", async () => {
    await upsertAdmin(db, admin);
    const session = await callAuth("/sign-in/email", {
      email: "admin@example.com",
      password: admin.ADMIN_PASSWORD,
    });
    const result = await upsertAdmin(db, {
      ...admin,
      ADMIN_PASSWORD: "Rotated-admin-pass-77",
      ADMIN_NAME: "Chief Admin",
    });
    expect(result.created).toBe(false);
    expect(await db.user.count()).toBe(1);
    expect(await db.account.count()).toBe(1);
    expect(await db.session.count()).toBe(0);

    const stale = await callAuth("/get-session", null, {
      method: "GET",
      cookie: session.sessionCookie!,
    });
    expect(stale.body).toBeNull();
    const old = await callAuth("/sign-in/email", {
      email: "admin@example.com",
      password: admin.ADMIN_PASSWORD,
    });
    expect(old.status).toBe(401);
    const fresh = await callAuth("/sign-in/email", {
      email: "admin@example.com",
      password: "Rotated-admin-pass-77",
    });
    expect(fresh.status).toBe(200);
    expect(fresh.body.user.name).toBe("Chief Admin");
  });

  it("promotes an existing account with that email", async () => {
    await callAuth("/sign-up/email", {
      name: "Existing",
      email: "admin@example.com",
      password: "Existing-user-pass-3",
      userTypeId: (
        await db.userType.findUniqueOrThrow({ where: { key: "customer" } })
      ).id,
      termsAccepted: true,
    });
    await upsertAdmin(db, admin);
    const user = await db.user.findUniqueOrThrow({
      where: { email: "admin@example.com" },
    });
    expect(user.role).toBe("admin");
  });

  it("refuses short or common admin passwords and bad emails", async () => {
    for (const input of [
      { ...admin, ADMIN_PASSWORD: "Short-pass1" },
      { ...admin, ADMIN_PASSWORD: "passwordpassword" },
      { ...admin, ADMIN_EMAIL: "not-an-email" },
    ]) {
      await expect(upsertAdmin(db, input)).rejects.toThrow();
    }
    expect(await db.user.count()).toBe(0);
  });
});
