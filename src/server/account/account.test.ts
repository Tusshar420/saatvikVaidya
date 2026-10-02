import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { placeholderEmailFor } from "@/server/auth/placeholder-email";
import { readAccount } from "@/server/auth/account";
import { createAddress, deleteAddress, listAddresses, parseAddress } from "@/server/checkout/addresses";
import { db } from "@/server/db";
import { sendOrderConfirmation, sendShipmentUpdate } from "@/server/notify/orders";
import type { Message } from "@/server/notify";
import { seedDatabase } from "@/server/seed";
import { callAuth, captureMessages, freshIp, resetAuthData, userTypeIds } from "../../../tests/setup/auth";
import { clearContentTables } from "../../../tests/setup/content-db";
import { makeOrder } from "../../../tests/setup/orders";
import { makeUser, validAddress } from "../../../tests/setup/shop";
import { updateName, updateNotifications } from "./settings";

// /account: name, notification preferences, password, email verification and
// saved addresses. Only the signed-in user's own rows are ever touched.

let sent: Message[];

beforeEach(async () => {
  await resetAuthData(db);
  sent = captureMessages();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("name and notification preferences", () => {
  it("updates the name, trimmed, and refuses a bad one", async () => {
    const id = await makeUser(db);
    expect(await updateName(id, { name: "  Meera Joshi " })).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id } })).name).toBe("Meera Joshi");
    for (const name of ["", " ", "A", "x".repeat(81)]) {
      const result = await updateName(id, { name });
      expect(result.ok).toBe(false);
    }
    expect((await db.user.findUniqueOrThrow({ where: { id } })).name).toBe("Meera Joshi");
  });

  it("saves the three preferences, and an unticked box means off", async () => {
    const id = await makeUser(db);
    let account = await readAccount(id);
    expect(account).toMatchObject({ notifyOrderSms: true, notifyOrderEmail: true, marketingOptIn: false });

    await updateNotifications(id, { notifyOrderEmail: "on", marketingOptIn: "on" });
    account = await readAccount(id);
    expect(account).toMatchObject({ notifyOrderSms: false, notifyOrderEmail: true, marketingOptIn: true });
  });

  it("only changes the given user", async () => {
    const mine = await makeUser(db);
    const other = await makeUser(db);
    await updateName(mine, { name: "Only Me" });
    await updateNotifications(mine, {});
    expect((await db.user.findUniqueOrThrow({ where: { id: other } })).name).not.toBe("Only Me");
    expect(await readAccount(other)).toMatchObject({ notifyOrderSms: true, notifyOrderEmail: true });
  });

  it("reports whether the account has a password", async () => {
    const types = await userTypeIds(db);
    await callAuth("/sign-up/email", {
      name: "Has Password",
      email: "haspw@example.com",
      password: "Guduchi-stem-11",
      userTypeId: types.customer,
      termsAccepted: true,
    });
    const withPassword = await db.user.findUniqueOrThrow({ where: { email: "haspw@example.com" } });
    expect((await readAccount(withPassword.id))?.hasPassword).toBe(true);
    const phoneOnly = await makeUser(db);
    expect((await readAccount(phoneOnly))?.hasPassword).toBe(false);
  });
});

describe("notification preferences on order messages", () => {
  beforeEach(async () => {
    await clearContentTables(db);
    await seedDatabase(db);
    sent = captureMessages();
  });

  it("sends the confirmation by email unless the buyer turned email off", async () => {
    const order = await makeOrder(db, { email: "buyer-on@example.com" });
    expect(sent.filter((message) => message.channel === "email")).toHaveLength(1);

    sent.length = 0;
    const quiet = await makeOrder(db, { email: "buyer-off@example.com" });
    sent.length = 0;
    await db.user.update({ where: { id: quiet.userId }, data: { notifyOrderEmail: false } });
    await sendOrderConfirmation(quiet.orderId);
    await sendShipmentUpdate(quiet.orderId, "in_transit");
    expect(sent).toEqual([]);

    // The other buyer is unaffected.
    await sendOrderConfirmation(order.orderId);
    expect(sent).toHaveLength(1);
  });

  it("sends phone-only buyers an SMS unless they turned SMS off", async () => {
    const order = await makeOrder(db, { phoneNumber: "+919811122233", email: placeholderEmailFor("+919811122233") });
    sent.length = 0;
    await sendOrderConfirmation(order.orderId);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ channel: "sms", to: "+919811122233" });

    sent.length = 0;
    await db.user.update({ where: { id: order.userId }, data: { notifyOrderSms: false } });
    await sendOrderConfirmation(order.orderId);
    expect(sent).toEqual([]);
  });
});

describe("change password", () => {
  async function signUpAndIn() {
    const types = await userTypeIds(db);
    const ip = freshIp();
    await callAuth("/sign-up/email", {
      name: "Pass Word",
      email: "pw@example.com",
      password: "Guduchi-stem-11",
      userTypeId: types.customer,
      termsAccepted: true,
    }, { ip });
    const first = await callAuth("/sign-in/email", { email: "pw@example.com", password: "Guduchi-stem-11" }, { ip });
    const second = await callAuth("/sign-in/email", { email: "pw@example.com", password: "Guduchi-stem-11" }, { ip });
    return { first: first.sessionCookie!, second: second.sessionCookie! };
  }

  it("needs the right current password, and our password rules", async () => {
    const { first } = await signUpAndIn();
    const wrong = await callAuth("/change-password", { currentPassword: "Not-my-password-1", newPassword: "Brahmi-leaf-77" }, { cookie: first });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe("INVALID_PASSWORD");

    const common = await callAuth("/change-password", { currentPassword: "Guduchi-stem-11", newPassword: "password123" }, { cookie: first });
    expect(common.body.code).toBe("PASSWORD_TOO_COMMON");
    const short = await callAuth("/change-password", { currentPassword: "Guduchi-stem-11", newPassword: "abc" }, { cookie: first });
    expect(short.body.code).toBe("PASSWORD_TOO_SHORT");

    const stillOld = await callAuth("/sign-in/email", { email: "pw@example.com", password: "Guduchi-stem-11" });
    expect(stillOld.status).toBe(200);
  });

  it("changes it and signs out the other sessions, but not this one", async () => {
    const { first, second } = await signUpAndIn();
    // What changePasswordAction does: change, then revoke the other sessions.
    const changed = await callAuth(
      "/change-password",
      { currentPassword: "Guduchi-stem-11", newPassword: "Brahmi-leaf-77" },
      { cookie: first },
    );
    expect(changed.status).toBe(200);
    const revoked = await callAuth("/revoke-other-sessions", {}, { cookie: first });
    expect(revoked.status).toBe(200);

    const current = await callAuth("/get-session", null, { cookie: first, method: "GET" });
    expect(current.body?.user?.email).toBe("pw@example.com");
    const stale = await callAuth("/get-session", null, { cookie: second, method: "GET" });
    expect(stale.body).toBeNull();

    const old = await callAuth("/sign-in/email", { email: "pw@example.com", password: "Guduchi-stem-11" });
    expect(old.status).not.toBe(200);
    const fresh = await callAuth("/sign-in/email", { email: "pw@example.com", password: "Brahmi-leaf-77" });
    expect(fresh.status).toBe(200);
  });
});

describe("email verification link", () => {
  it("sends one link by email, and following it verifies the address", async () => {
    const types = await userTypeIds(db);
    await callAuth("/sign-up/email", {
      name: "Verify Me",
      email: "verifyme@example.com",
      password: "Guduchi-stem-11",
      userTypeId: types.customer,
      termsAccepted: true,
    });
    sent.length = 0;
    const reply = await callAuth("/send-verification-email", { email: "verifyme@example.com", callbackURL: "/account?emailVerified=1" });
    expect(reply.status).toBe(200);
    expect(sent).toHaveLength(1);
    const [message] = sent;
    expect(message).toMatchObject({ channel: "email", to: "verifyme@example.com" });
    const link = /https?:\/\/\S+/.exec(message.text)?.[0];
    expect(link).toBeDefined();
    const url = new URL(link!);
    expect(url.pathname).toBe("/api/auth/verify-email");

    const before = await db.user.findUniqueOrThrow({ where: { email: "verifyme@example.com" } });
    expect(before.emailVerified).toBe(false);
    const done = await callAuth(`${url.pathname.replace("/api/auth", "")}${url.search}`, null, { method: "GET" });
    expect([200, 302]).toContain(done.status);
    const after = await db.user.findUniqueOrThrow({ where: { email: "verifyme@example.com" } });
    expect(after.emailVerified).toBe(true);
  });

  it("rate-limits requests for one address and refuses extra fields", async () => {
    const results: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const reply = await callAuth("/send-verification-email", { email: "spam@example.com" });
      results.push(reply.status);
    }
    expect(results.slice(0, 3)).not.toContain(429);
    expect(results[3]).toBe(429);

    const extra = await callAuth("/send-verification-email", { email: "x@example.com", role: "admin" });
    expect(extra.status).toBe(400);
  });
});

describe("saved addresses", () => {
  it("deletes only the owner's address", async () => {
    const mine = await makeUser(db);
    const other = await makeUser(db);
    const parsed = parseAddress(validAddress);
    if (!parsed.success) throw new Error("fixture should be valid");
    const created = await createAddress(mine, parsed.data);
    if (!created.ok) throw new Error("not created");

    expect(await deleteAddress(other, created.id)).toBe(false);
    expect(await listAddresses(mine)).toHaveLength(1);
    expect(await deleteAddress(mine, created.id)).toBe(true);
    expect(await listAddresses(mine)).toHaveLength(0);
    expect(await deleteAddress(mine, created.id)).toBe(false);
  });

  it("keeps past orders' address when the saved one is deleted", async () => {
    await clearContentTables(db);
    await seedDatabase(db);
    const order = await makeOrder(db);
    const [address] = await listAddresses(order.userId);
    expect(await deleteAddress(order.userId, address.id)).toBe(true);
    const stored = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(stored.shipLine1).toBe(validAddress.line1);
  });
});
