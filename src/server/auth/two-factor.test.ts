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
  freshIp,
  freshPhone,
  lastOtp,
  e164,
  resetAuthData,
  userTypeIds,
} from "../../../tests/setup/auth";
import { keyFromOtpAuthUri, totpCode } from "../../../tests/setup/totp";
import { upsertAdmin } from "./admin";

// Admin two-factor (P1.11): admin pages need it, it is set up at the first
// sign-in, and a password (or a phone code) alone never opens the panel.

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

const { requireAdmin } = await import("./session");

const email = "boss@example.com";
const password = "A-long-admin-passphrase-1";

let sent: ReturnType<typeof captureMessages>;

beforeEach(async () => {
  await resetAuthData(db);
  sent = captureMessages();
  request.cookie = "";
  await upsertAdmin(db, { ADMIN_EMAIL: email, ADMIN_PASSWORD: password });
});

afterEach(() => vi.restoreAllMocks());
afterAll(() => db.$disconnect());

/** Signs in with the password and sets up an authenticator, as /account/two-factor does. */
async function enroll() {
  const ip = freshIp();
  const signIn = await callAuth("/sign-in/email", { email, password }, { ip });
  expect(signIn.sessionCookie).not.toBeNull();
  const enable = await callAuth(
    "/two-factor/enable",
    { password },
    { ip, cookie: signIn.sessionCookie! },
  );
  expect(enable.status).toBe(200);
  const key = keyFromOtpAuthUri(enable.body.totpURI);
  const verify = await callAuth(
    "/two-factor/verify-totp",
    { code: totpCode(key) },
    { ip, cookie: signIn.sessionCookie! },
  );
  expect(verify.status).toBe(200);
  return { key, backupCodes: enable.body.backupCodes as string[] };
}

describe("admin two-factor", () => {
  it("sends an admin without it to the setup page, not into the panel", async () => {
    const signIn = await callAuth("/sign-in/email", { email, password });
    request.cookie = signIn.sessionCookie!;
    await expect(requireAdmin("dashboard")).rejects.toThrow(
      "redirect:/account/two-factor",
    );
    // The same for every area: nothing loads before two-factor is on.
    await expect(requireAdmin("users")).rejects.toThrow(
      "redirect:/account/two-factor",
    );
  });

  it("setup: the first correct code turns it on and opens the panel", async () => {
    const { key, backupCodes } = await enroll();
    expect(backupCodes).toHaveLength(8);
    expect(
      (await db.user.findUniqueOrThrow({ where: { email } })).twoFactorEnabled,
    ).toBe(true);

    // Sign in again: the password alone gives no session.
    const ip = freshIp();
    const signIn = await callAuth("/sign-in/email", { email, password }, { ip });
    expect(signIn.body.twoFactorRedirect).toBe(true);
    expect(signIn.sessionCookie).toBeNull();
    request.cookie = signIn.cookies;
    await expect(requireAdmin("dashboard")).rejects.toThrow(/redirect:\/\?auth=sign-in/);

    const wrong = await callAuth("/two-factor/verify-totp", { code: "000000" }, { ip, cookie: signIn.cookies });
    expect(wrong.status).toBe(401);
    expect(wrong.sessionCookie).toBeNull();

    const right = await callAuth(
      "/two-factor/verify-totp",
      { code: totpCode(key) },
      { ip, cookie: signIn.cookies },
    );
    expect(right.status).toBe(200);
    request.cookie = right.sessionCookie!;
    expect((await requireAdmin("dashboard")).user.role).toBe("admin");
  });

  it("a backup code signs in once", async () => {
    const { backupCodes } = await enroll();
    const code = backupCodes[0]!;
    const attempt = async () => {
      const ip = freshIp();
      const signIn = await callAuth("/sign-in/email", { email, password }, { ip });
      return callAuth(
        "/two-factor/verify-backup-code",
        { code },
        { ip, cookie: signIn.cookies },
      );
    };
    const first = await attempt();
    expect(first.status).toBe(200);
    expect(first.sessionCookie).not.toBeNull();
    expect((await attempt()).status).not.toBe(200);
  });

  it("two-factor codes are rate limited per IP", async () => {
    await enroll();
    const ip = freshIp();
    const signIn = await callAuth("/sign-in/email", { email, password }, { ip });
    let last = 0;
    for (let i = 0; i < 12; i++) {
      last = (
        await callAuth("/two-factor/verify-totp", { code: "000000" }, { ip, cookie: signIn.cookies })
      ).status;
    }
    expect(last).toBe(429);
  });

  it("nobody can switch it off from the app", async () => {
    await enroll();
    const ip = freshIp();
    // (a signed-in session needs the second step first)
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const signIn = await callAuth("/sign-in/email", { email, password }, { ip });
    expect(user.twoFactorEnabled).toBe(true);
    const disable = await callAuth("/two-factor/disable", { password }, { ip, cookie: signIn.cookies });
    expect(disable.status).toBe(403);
    expect(
      (await db.user.findUniqueOrThrow({ where: { email } })).twoFactorEnabled,
    ).toBe(true);
  });

  it("an admin's phone code can't skip the second factor", async () => {
    const types = await userTypeIds(db);
    const phone = freshPhone();
    await db.user.update({
      where: { email },
      data: { phoneNumber: e164(phone), phoneNumberVerified: true, userTypeId: types.customer },
    });
    const ip = freshIp();
    expect((await callAuth("/phone-number/send-otp", { phoneNumber: phone }, { ip })).status).toBe(200);
    const verify = await callAuth(
      "/phone-number/verify",
      { phoneNumber: phone, code: lastOtp(sent, e164(phone)) },
      { ip },
    );
    expect(verify.status).toBe(400);
    expect(verify.body.code).toBe("INVALID_OTP");
    expect(verify.sessionCookie).toBeNull();
  });
});
