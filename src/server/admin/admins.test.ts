import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { callAuth, captureMessages, resetAuthData, userTypeIds } from "../../../tests/setup/auth";
import {
  acceptInvite,
  changeAdminRole,
  findLiveInvite,
  inviteAdmin,
  listAdmins,
  listPendingInvites,
  removeAdmin,
  resetAdminTwoFactor,
  revokeInvite,
} from "./admins";

let sent: ReturnType<typeof captureMessages>;
let types: Record<string, number>;
const boss = { id: "boss", name: "Boss" };

async function makeAdmin(id: string, adminRole: "super" | "orders" | "content", extra = {}) {
  await db.user.create({
    data: {
      id,
      name: id,
      email: `${id}@example.test`,
      role: "admin",
      adminRole,
      twoFactorEnabled: true,
      userTypeId: types.customer,
      termsAcceptedAt: new Date(),
      ...extra,
    },
  });
}

/** The token in the last invitation email. */
function lastToken(): string {
  const mail = sent.findLast((message) => message.channel === "email");
  const match = mail?.text.match(/\/admin-invite\/([\w-]+)/);
  if (!match) throw new Error("No invitation email was sent");
  return match[1]!;
}

const strong = "A-long-admin-passphrase-1";

beforeEach(async () => {
  await resetAuthData(db);
  types = await userTypeIds(db);
  sent = captureMessages();
  await makeAdmin("boss", "super");
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => db.$disconnect());

describe("admin invites", () => {
  it("emails a one-time link and creates the admin on acceptance", async () => {
    const invited = await inviteAdmin({ email: "New.Person@Example.com", role: "orders" }, boss);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ channel: "email", to: "new.person@example.com" });
    const token = lastToken();
    // The same link is handed back to show the inviting admin.
    expect(invited).toEqual({ ok: true, url: expect.stringMatching(new RegExp(`/admin-invite/${token}$`)) });

    // Only a hash of the token is stored.
    const [invite] = await db.adminInvite.findMany();
    expect(invite!.tokenHash).not.toContain(token);
    expect(invite).toMatchObject({ email: "new.person@example.com", adminRole: "orders", invitedById: "boss" });
    expect(await findLiveInvite(token)).toEqual({ email: "new.person@example.com", adminRole: "orders" });

    const result = await acceptInvite(token, { name: "New Person", password: strong, confirm: strong });
    expect(result).toEqual({ ok: true });
    const user = await db.user.findUniqueOrThrow({ where: { email: "new.person@example.com" } });
    expect(user).toMatchObject({
      role: "admin",
      adminRole: "orders",
      emailVerified: true,
      twoFactorEnabled: false,
    });

    // They can sign in with the password; two-factor is next.
    const signIn = await callAuth("/sign-in/email", { email: "new.person@example.com", password: strong });
    expect(signIn.status).toBe(200);

    // The link is used up.
    expect(await findLiveInvite(token)).toBeNull();
    expect(await acceptInvite(token, { name: "Again", password: strong, confirm: strong })).toMatchObject({ ok: false });
    expect(await db.user.count({ where: { role: "admin" } })).toBe(2);
  });

  it("logs the invite and its acceptance", async () => {
    await inviteAdmin({ email: "log@example.com", role: "content" }, boss);
    await acceptInvite(lastToken(), { name: "Log Person", password: strong, confirm: strong });
    const actions = (await db.adminLog.findMany({ orderBy: { id: "asc" } })).map((row) => row.action);
    expect(actions).toEqual(["admin.invite", "admin.invite.accept"]);
  });

  it("refuses a bad email or role, and an email that already has an account", async () => {
    expect(await inviteAdmin({ email: "nope", role: "orders" }, boss)).toMatchObject({ ok: false, field: "email" });
    expect(await inviteAdmin({ email: "a@example.com", role: "owner" }, boss)).toMatchObject({ ok: false, field: "role" });
    expect(await inviteAdmin({ email: "boss@example.test", role: "orders" }, boss)).toMatchObject({
      ok: false,
      field: "email",
    });
    expect(await db.adminInvite.count()).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("a new invite replaces the old one, and a revoked or expired one stops working", async () => {
    await inviteAdmin({ email: "x@example.com", role: "orders" }, boss);
    const first = lastToken();
    await inviteAdmin({ email: "x@example.com", role: "content" }, boss);
    const second = lastToken();
    expect(await findLiveInvite(first)).toBeNull();
    expect(await listPendingInvites()).toHaveLength(1);

    const [invite] = await listPendingInvites();
    expect(await revokeInvite(invite!.id, "boss")).toEqual({ ok: true });
    expect(await findLiveInvite(second)).toBeNull();
    expect(await revokeInvite(invite!.id, "boss")).toMatchObject({ ok: false });

    await inviteAdmin({ email: "y@example.com", role: "orders" }, boss);
    const third = lastToken();
    await db.adminInvite.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await findLiveInvite(third)).toBeNull();
    expect(await acceptInvite(third, { name: "Late", password: strong, confirm: strong })).toMatchObject({ ok: false });
  });

  it("checks the name and password when accepting (and keeps the invite on a typo)", async () => {
    await inviteAdmin({ email: "z@example.com", role: "orders" }, boss);
    const token = lastToken();
    expect(await acceptInvite(token, { name: "Z", password: strong, confirm: strong })).toMatchObject({ field: "name" });
    expect(await acceptInvite(token, { name: "Zed", password: "short", confirm: "short" })).toMatchObject({ field: "password" });
    expect(await acceptInvite(token, { name: "Zed", password: "password1234", confirm: "password1234" })).toMatchObject({
      field: "password",
    });
    expect(await acceptInvite(token, { name: "Zed", password: strong, confirm: `${strong}x` })).toMatchObject({ field: "confirm" });
    expect(await findLiveInvite(token)).not.toBeNull();
  });

  it("a made-up token finds nothing", async () => {
    expect(await findLiveInvite("not-a-real-token-at-all-0000")).toBeNull();
    expect(await findLiveInvite("../../etc")).toBeNull();
  });

  it("two people can't both use one link", async () => {
    await inviteAdmin({ email: "race@example.com", role: "orders" }, boss);
    const token = lastToken();
    const results = await Promise.all([
      acceptInvite(token, { name: "First", password: strong, confirm: strong }),
      acceptInvite(token, { name: "Second", password: strong, confirm: strong }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await db.user.count({ where: { email: "race@example.com" } })).toBe(1);
  });
});

describe("managing admins", () => {
  beforeEach(async () => {
    await makeAdmin("ord", "orders");
  });

  it("changes a role, signs them out, and logs it", async () => {
    await db.session.create({
      data: { id: "s1", userId: "ord", token: "tok", expiresAt: new Date(Date.now() + 3600_000) },
    });
    expect(await changeAdminRole("ord", "content", "boss")).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: "ord" } })).adminRole).toBe("content");
    expect(await db.session.count({ where: { userId: "ord" } })).toBe(0);
    const log = await db.adminLog.findFirstOrThrow({ where: { action: "admin.role.update" } });
    expect(log.changes).toEqual({ adminRole: { from: "orders", to: "content" } });
  });

  it("refuses an unknown role, your own account and non-admins", async () => {
    expect(await changeAdminRole("ord", "owner", "boss")).toMatchObject({ ok: false });
    expect(await changeAdminRole("boss", "orders", "boss")).toMatchObject({ ok: false });
    expect(await removeAdmin("boss", "boss")).toMatchObject({ ok: false });
    expect(await resetAdminTwoFactor("boss", "boss")).toMatchObject({ ok: false });
    await db.user.create({
      data: { id: "cust", name: "C", email: "c@example.test", userTypeId: types.customer, termsAcceptedAt: new Date() },
    });
    expect(await changeAdminRole("cust", "orders", "boss")).toMatchObject({ ok: false });
  });

  it("never leaves the site without a super admin", async () => {
    await makeAdmin("boss2", "super");
    expect(await changeAdminRole("boss2", "orders", "boss")).toEqual({ ok: true });
    // Only "boss" is super now; another super admin can't demote or remove them.
    await makeAdmin("boss3", "orders");
    await db.user.update({ where: { id: "boss3" }, data: { adminRole: "super" } });
    expect(await removeAdmin("boss", "boss3")).toEqual({ ok: true });
    expect(await db.user.count({ where: { adminRole: "super" } })).toBe(1);
    expect(await changeAdminRole("boss", "orders", "ord")).toMatchObject({ ok: false });
    expect(await removeAdmin("boss", "ord")).toMatchObject({ ok: false });
  });

  it("resets two-factor so it's set up again at next sign-in", async () => {
    await db.twoFactor.create({ data: { id: "tf", userId: "ord", secret: "x", backupCodes: "y" } });
    expect(await resetAdminTwoFactor("ord", "boss")).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: "ord" } })).twoFactorEnabled).toBe(false);
    expect(await db.twoFactor.count({ where: { userId: "ord" } })).toBe(0);
    expect(await db.adminLog.count({ where: { action: "admin.2fa.reset" } })).toBe(1);
  });

  it("removing an admin makes them an ordinary account", async () => {
    expect(await removeAdmin("ord", "boss")).toEqual({ ok: true });
    expect(await db.user.findUniqueOrThrow({ where: { id: "ord" } })).toMatchObject({
      role: "user",
      adminRole: null,
      twoFactorEnabled: false,
    });
    expect((await listAdmins()).map((admin) => admin.id)).toEqual(["boss"]);
    expect(await db.adminLog.count({ where: { action: "admin.remove" } })).toBe(1);
  });
});
