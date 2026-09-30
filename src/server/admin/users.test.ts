import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { verifyPassword } from "better-auth/crypto";
import { db } from "@/server/db";
import { placeholderEmailFor } from "@/server/auth/placeholder-email";
import { resetAuthData, userTypeIds } from "../../../tests/setup/auth";
import {
  createUser,
  decideVerification,
  deleteUsers,
  getUserDetail,
  listPendingApprovals,
  listUsers,
  updateUser,
  userFiltersSchema,
  userInputSchema,
  type UserInput,
} from "./users";

let types: Record<string, number>;
let adminId: string;

async function makeUser(
  id: string,
  data: {
    name: string;
    type: string;
    email?: string;
    phone?: string;
    status?: "none" | "pending" | "approved" | "rejected";
    role?: "user" | "admin";
  },
) {
  await db.user.create({
    data: {
      id,
      name: data.name,
      email: data.email ?? `${id}@example.test`,
      phoneNumber: data.phone ?? null,
      userTypeId: types[data.type],
      verificationStatus: data.status ?? "none",
      role: data.role ?? "user",
      termsAcceptedAt: new Date(),
    },
  });
  return id;
}

/** Form-style input, as a server action would parse it. */
function input(values: Record<string, string>): UserInput {
  return userInputSchema.parse({
    verificationStatus: "none",
    role: "user",
    ...values,
  });
}

beforeEach(async () => {
  await resetAuthData(db);
  types = await userTypeIds(db);
  adminId = await makeUser("admin-1", {
    name: "Asha Admin",
    type: "customer",
    role: "admin",
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("listUsers", () => {
  beforeEach(async () => {
    await makeUser("u-doc", {
      name: "Dr Kavya Rao",
      type: "doctor",
      phone: "+919876500001",
      status: "pending",
    });
    await makeUser("u-pharm", {
      name: "Meera Pharmacy",
      type: "pharmacy",
      status: "approved",
    });
    await makeUser("u-cust", {
      name: "Ravi Kumar",
      type: "customer",
      email: "ravi@example.test",
    });
    await makeUser("u-phone", {
      name: "Phone Only",
      type: "customer",
      email: placeholderEmailFor("+919876500002"),
      phone: "+919876500002",
    });
  });

  const names = async (query: Record<string, string>) =>
    (await listUsers(userFiltersSchema.parse(query))).rows
      .map((row) => row.name)
      .sort();

  it("searches by name, email and phone digits", async () => {
    expect(await names({ q: "kavya" })).toEqual(["Dr Kavya Rao"]);
    expect(await names({ q: "ravi@" })).toEqual(["Ravi Kumar"]);
    expect(await names({ q: "98765 00001" })).toEqual(["Dr Kavya Rao"]);
    expect(await names({ q: "+91 98765 00002" })).toEqual(["Phone Only"]);
  });

  it("filters by user type, verification status and role", async () => {
    expect(await names({ type: "doctor" })).toEqual(["Dr Kavya Rao"]);
    expect(await names({ status: "approved" })).toEqual(["Meera Pharmacy"]);
    expect(await names({ role: "admin" })).toEqual(["Asha Admin"]);
    expect(await names({ type: "customer", q: "ravi" })).toEqual([
      "Ravi Kumar",
    ]);
  });

  it("ignores invalid filters instead of failing", async () => {
    const filters = userFiltersSchema.parse({
      status: "nonsense",
      type: "'; DROP TABLE User; --",
      page: "-4",
    });
    expect(filters).toEqual({ page: 1 });
    expect((await listUsers(filters)).total).toBe(5);
  });

  it("never returns the phone placeholder email", async () => {
    const [row] = (await listUsers(userFiltersSchema.parse({ q: "Phone Only" })))
      .rows;
    expect(row.email).toBeNull();
    expect(row.phoneNumber).toBe("+919876500002");
  });

  it("lists pending professionals only, oldest first", async () => {
    await makeUser("u-cust-pending", {
      name: "Odd Customer",
      type: "customer",
      status: "pending",
    });
    const pending = await listPendingApprovals();
    expect(pending.map((row) => row.name)).toEqual(["Dr Kavya Rao"]);
  });
});

describe("createUser", () => {
  it("creates a customer by email with a password they can sign in with", async () => {
    const result = await createUser(
      input({
        name: "New Customer",
        email: "New@Example.test",
        userTypeId: String(types.customer),
        password: "a-long-unusual-password",
        marketingOptIn: "on",
      }),
      adminId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const user = await db.user.findUniqueOrThrow({
      where: { id: result.id },
      include: { accounts: true },
    });
    expect(user).toMatchObject({
      email: "new@example.test",
      role: "user",
      verificationStatus: "none",
      marketingOptIn: true,
    });
    const hash = user.accounts[0].password ?? "";
    expect(hash).not.toContain("a-long-unusual-password");
    expect(
      await verifyPassword({ hash, password: "a-long-unusual-password" }),
    ).toBe(true);
  });

  it("gives a phone-only account the placeholder email", async () => {
    const result = await createUser(
      input({
        name: "Phone Person",
        phone: "98765 43210",
        userTypeId: String(types.customer),
      }),
      adminId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const user = await db.user.findUniqueOrThrow({ where: { id: result.id } });
    expect(user.phoneNumber).toBe("+919876543210");
    expect(user.email).toBe(placeholderEmailFor("+919876543210"));
  });

  it("keeps verification in line with the user type", async () => {
    const doctor = await createUser(
      input({
        name: "Dr New",
        email: "drnew@example.test",
        userTypeId: String(types.doctor),
        verificationStatus: "none",
      }),
      adminId,
    );
    const customer = await createUser(
      input({
        name: "Customer New",
        email: "cnew@example.test",
        userTypeId: String(types.customer),
        verificationStatus: "approved",
      }),
      adminId,
    );
    if (!doctor.ok || !customer.ok) throw new Error("create failed");
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: doctor.id } }))
        .verificationStatus,
    ).toBe("pending");
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: customer.id } }))
        .verificationStatus,
    ).toBe("none");
  });

  it("creates an admin only with a strong password", async () => {
    const base = {
      name: "Second Admin",
      email: "admin2@example.test",
      userTypeId: String(types.customer),
      role: "admin",
    };
    expect(await createUser(input(base), adminId)).toMatchObject({
      ok: false,
      fieldErrors: { password: expect.any(String) },
    });
    expect(
      await createUser(input({ ...base, password: "short-pass" }), adminId),
    ).toMatchObject({ ok: false, fieldErrors: { password: expect.any(String) } });
    const ok = await createUser(
      input({ ...base, password: "a-much-longer-admin-pass" }),
      adminId,
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: ok.id } })).role,
      ).toBe("admin");
    }
  });

  it("refuses a taken email or phone, and a missing contact", async () => {
    await makeUser("u-taken", {
      name: "Taken",
      type: "customer",
      email: "taken@example.test",
      phone: "+919812345678",
    });
    const type = String(types.customer);
    expect(
      await createUser(
        input({ name: "Copy", email: "TAKEN@example.test", userTypeId: type }),
        adminId,
      ),
    ).toMatchObject({ ok: false, fieldErrors: { email: expect.any(String) } });
    expect(
      await createUser(
        input({ name: "Copy", phone: "9812345678", userTypeId: type }),
        adminId,
      ),
    ).toMatchObject({ ok: false, fieldErrors: { phone: expect.any(String) } });
    const missing = userInputSchema.safeParse({
      name: "Nobody",
      userTypeId: type,
      role: "user",
      verificationStatus: "none",
    });
    expect(missing.success).toBe(false);
  });

  it("rejects bad input", () => {
    const bad = userInputSchema.safeParse({
      name: "X",
      email: "not-an-email",
      phone: "12345",
      userTypeId: "abc",
      role: "superuser",
      verificationStatus: "none",
    });
    expect(bad.success).toBe(false);
    const fields = bad.success
      ? []
      : bad.error.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(
      expect.arrayContaining(["name", "userTypeId", "role"]),
    );
    // Placeholder-domain emails can't be entered by hand.
    expect(
      userInputSchema.safeParse({
        name: "Sneaky",
        email: placeholderEmailFor("+919876543210"),
        userTypeId: String(types.customer),
        role: "user",
        verificationStatus: "none",
      }).success,
    ).toBe(false);
  });

  it("writes an audit row without the password", async () => {
    const result = await createUser(
      input({
        name: "Logged",
        email: "logged@example.test",
        userTypeId: String(types.customer),
        password: "a-long-unusual-password",
      }),
      adminId,
    );
    if (!result.ok) throw new Error("create failed");
    const log = await db.adminLog.findFirstOrThrow({
      where: { action: "user.create", resourceId: result.id },
    });
    expect(log.userId).toBe(adminId);
    expect(log.resource).toBe("User");
    expect(JSON.stringify(log.changes)).not.toContain("a-long-unusual");
    expect(log.changes).toMatchObject({
      name: { from: null, to: "Logged" },
      password: { from: null, to: "set" },
    });
  });
});

describe("updateUser", () => {
  beforeEach(async () => {
    await makeUser("u-edit", {
      name: "Edit Me",
      type: "customer",
      email: "edit@example.test",
    });
    await db.user.update({
      where: { id: "u-edit" },
      data: { emailVerified: true },
    });
    await db.session.create({
      data: {
        id: "s-edit",
        token: "token-edit",
        userId: "u-edit",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
  });

  it("saves changes, marks a new email unverified and logs the diff", async () => {
    const result = await updateUser(
      "u-edit",
      input({
        name: "Edited",
        email: "new-edit@example.test",
        userTypeId: String(types.doctor),
        verificationStatus: "approved",
      }),
      adminId,
    );
    expect(result).toEqual({ ok: true, id: "u-edit" });
    const user = await db.user.findUniqueOrThrow({ where: { id: "u-edit" } });
    expect(user).toMatchObject({
      name: "Edited",
      email: "new-edit@example.test",
      emailVerified: false,
      userTypeId: types.doctor,
      verificationStatus: "approved",
    });
    const log = await db.adminLog.findFirstOrThrow({
      where: { action: "user.update", resourceId: "u-edit" },
    });
    expect(Object.keys(log.changes as object).sort()).toEqual([
      "email",
      "name",
      "userTypeId",
      "verificationStatus",
    ]);
    // The session survives: the role didn't change.
    expect(await db.session.count({ where: { userId: "u-edit" } })).toBe(1);
  });

  it("signs the user out everywhere when their role changes", async () => {
    await updateUser(
      "u-edit",
      input({
        name: "Edit Me",
        email: "edit@example.test",
        userTypeId: String(types.customer),
        role: "admin",
      }),
      adminId,
    );
    expect(await db.session.count({ where: { userId: "u-edit" } })).toBe(0);
  });

  it("won't let an admin remove their own admin role", async () => {
    const result = await updateUser(
      adminId,
      input({
        name: "Asha Admin",
        email: "admin-1@example.test",
        userTypeId: String(types.customer),
        role: "user",
      }),
      adminId,
    );
    expect(result).toMatchObject({ ok: false, fieldErrors: { role: expect.any(String) } });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: adminId } })).role,
    ).toBe("admin");
  });

  it("writes nothing when nothing changed, and null for a missing user", async () => {
    await updateUser(
      "u-edit",
      input({
        name: "Edit Me",
        email: "edit@example.test",
        userTypeId: String(types.customer),
      }),
      adminId,
    );
    expect(await db.adminLog.count()).toBe(0);
    expect(
      await updateUser(
        "missing",
        input({
          name: "Ghost",
          email: "ghost@example.test",
          userTypeId: String(types.customer),
        }),
        adminId,
      ),
    ).toBeNull();
  });
});

describe("decideVerification and deleteUsers", () => {
  beforeEach(async () => {
    await makeUser("d1", { name: "Doc One", type: "doctor", status: "pending" });
    await makeUser("d2", { name: "Doc Two", type: "stockist", status: "pending" });
    await makeUser("c1", { name: "Cust One", type: "customer" });
  });

  it("bulk approves professionals, skips customers and logs the note", async () => {
    const result = await decideVerification(
      ["d1", "d2", "c1", "d1"],
      "approved",
      "Registration checked",
      adminId,
    );
    expect(result).toEqual({ changed: 2, skipped: 1 });
    const statuses = await db.user.findMany({
      where: { id: { in: ["d1", "d2", "c1"] } },
      select: { id: true, verificationStatus: true },
      orderBy: { id: "asc" },
    });
    expect(statuses).toEqual([
      { id: "c1", verificationStatus: "none" },
      { id: "d1", verificationStatus: "approved" },
      { id: "d2", verificationStatus: "approved" },
    ]);
    const logs = await db.adminLog.findMany({ where: { action: "user.approve" } });
    expect(logs).toHaveLength(2);
    expect(logs[0].changes).toMatchObject({
      verificationStatus: { from: "pending", to: "approved" },
      note: "Registration checked",
    });
  });

  it("bulk rejects", async () => {
    await decideVerification(["d1"], "rejected", null, adminId);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: "d1" } }))
        .verificationStatus,
    ).toBe("rejected");
    expect((await getUserDetail("d1"))?.history[0]).toMatchObject({
      action: "user.reject",
      actorName: "Asha Admin",
      note: null,
    });
  });

  it("bulk deletes users with their sessions, never the acting admin", async () => {
    await db.session.create({
      data: {
        id: "s-d1",
        token: "token-d1",
        userId: "d1",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const result = await deleteUsers(["d1", "c1", adminId], adminId);
    expect(result).toEqual({ changed: 2, skipped: 1 });
    expect(await db.user.count({ where: { id: { in: ["d1", "c1"] } } })).toBe(0);
    expect(await db.session.count({ where: { userId: "d1" } })).toBe(0);
    expect(await db.user.count({ where: { id: adminId } })).toBe(1);
    expect(await db.adminLog.count({ where: { action: "user.delete" } })).toBe(2);
  });

  it("keeps the audit trail when the admin who made it is deleted", async () => {
    await decideVerification(["d1"], "approved", null, "admin-1");
    await makeUser("admin-2", { name: "Other Admin", type: "customer", role: "admin" });
    await deleteUsers([adminId], "admin-2");
    const log = await db.adminLog.findFirstOrThrow({
      where: { action: "user.approve" },
    });
    expect(log.userId).toBeNull();
  });
});

describe("getUserDetail", () => {
  it("reports sign-in methods without exposing the password hash", async () => {
    await makeUser("u-pw", { name: "Has Password", type: "customer", phone: "+919800000001" });
    await db.account.create({
      data: {
        id: "acc-pw",
        accountId: "u-pw",
        providerId: "credential",
        userId: "u-pw",
        password: "hash-that-must-not-leak",
      },
    });
    const detail = await getUserDetail("u-pw");
    expect(detail).toMatchObject({ hasPassword: true, phoneNumber: "+919800000001" });
    expect(JSON.stringify(detail)).not.toContain("hash-that-must-not-leak");
    expect(await getUserDetail("nobody")).toBeNull();
  });
});
