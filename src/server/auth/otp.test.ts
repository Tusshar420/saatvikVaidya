import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Message } from "@/server/notify";
import { db } from "@/server/db";
import {
  callAuth,
  captureMessages,
  e164,
  freshPhone,
  lastOtp,
  resetAuthData,
  userTypeIds,
  wrongCode,
} from "../../../tests/setup/auth";
import { otpPolicy } from "./policy";

let types: Record<string, number>;
let sent: Message[];

beforeEach(async () => {
  await resetAuthData(db);
  types = await userTypeIds(db);
  sent = captureMessages();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

async function sendOtp(national: string): Promise<string> {
  const reply = await callAuth("/phone-number/send-otp", {
    phoneNumber: national,
  });
  expect(reply.status).toBe(200);
  return lastOtp(sent, e164(national));
}

function verify(national: string, code: string, extra = {}) {
  return callAuth("/phone-number/verify", {
    phoneNumber: national,
    code,
    ...extra,
  });
}

async function registeredPhone(): Promise<string> {
  const national = freshPhone();
  const code = await sendOtp(national);
  const reply = await verify(national, code, {
    name: "Kavya Rao",
    userTypeId: types.customer,
    termsAccepted: true,
  });
  expect(reply.body.status).toBe(true);
  return national;
}

describe("OTP", () => {
  it("is 6 digits, expires in 5 minutes and goes by SMS to the E.164 number", async () => {
    const national = freshPhone();
    const before = Date.now();
    const code = await sendOtp(national);

    expect(code).toMatch(/^\d{6}$/);
    const sms = sent.at(-1);
    expect(sms).toMatchObject({ channel: "sms", to: e164(national) });
    expect(sms?.channel === "sms" && sms.text).toContain(code);

    const row = await db.verification.findFirstOrThrow({
      where: { identifier: e164(national) },
    });
    const lifetime = row.expiresAt.getTime() - before;
    expect(lifetime).toBeGreaterThan(otpPolicy.expiresInSeconds * 1000 - 5000);
    expect(lifetime).toBeLessThanOrEqual(
      otpPolicy.expiresInSeconds * 1000 + 1000,
    );
  });

  it("is refused once expired, for new and existing numbers", async () => {
    for (const national of [freshPhone(), await registeredPhone()]) {
      const code = await sendOtp(national);
      await db.verification.updateMany({
        where: { identifier: e164(national) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const reply = await verify(national, code, {
        name: "Kavya Rao",
        userTypeId: types.customer,
        termsAccepted: true,
      });
      expect(reply.status).toBe(400);
      expect(["OTP_EXPIRED", "OTP_NOT_FOUND"]).toContain(reply.body.code);
      expect(reply.sessionCookie).toBeNull();
    }
    expect(await db.user.count()).toBe(1);
  });

  it("allows 5 wrong attempts, then refuses even the right code", async () => {
    const national = freshPhone();
    const code = await sendOtp(national);

    for (let attempt = 1; attempt <= otpPolicy.allowedAttempts; attempt++) {
      const reply = await verify(national, wrongCode(code));
      expect(reply.status, `attempt ${attempt}`).toBe(400);
      expect(reply.body.code).toBe("INVALID_OTP");
    }
    const locked = await verify(national, code, {
      name: "Kavya Rao",
      userTypeId: types.customer,
      termsAccepted: true,
    });
    expect(locked.status).toBe(403);
    expect(locked.body.code).toBe("TOO_MANY_ATTEMPTS");
    expect(locked.sessionCookie).toBeNull();
    expect(await db.user.count()).toBe(0);

    // A new code works again.
    const fresh = await sendOtp(national);
    const reply = await verify(national, fresh, {
      name: "Kavya Rao",
      userTypeId: types.customer,
      termsAccepted: true,
    });
    expect(reply.body.status).toBe(true);
  });

  it("still accepts the right code after 4 wrong attempts", async () => {
    const national = await registeredPhone();
    const code = await sendOtp(national);
    for (let attempt = 1; attempt < otpPolicy.allowedAttempts; attempt++) {
      await verify(national, wrongCode(code));
    }
    const reply = await verify(national, code);
    expect(reply.status).toBe(200);
    expect(reply.sessionCookie).not.toBeNull();
  });

  it("counts attempts on the registration check too", async () => {
    // A wrong code for a new number goes through the normal check, so the
    // "registration required" reply can't be used to guess codes for free.
    const national = freshPhone();
    const code = await sendOtp(national);
    for (let attempt = 1; attempt <= otpPolicy.allowedAttempts; attempt++) {
      await verify(national, wrongCode(code));
    }
    const reply = await verify(national, code);
    expect(reply.status).toBe(403);
    expect(reply.body.registrationRequired).toBeUndefined();
  });

  it("only the latest code works after a resend", async () => {
    const national = await registeredPhone();
    const first = await sendOtp(national);
    let second = await sendOtp(national);
    while (second === first) second = await sendOtp(national);
    const old = await verify(national, first);
    expect(old.status).toBe(400);
    const current = await verify(national, second);
    expect(current.status).toBe(200);
  });

  it("refuses badly formed codes before checking them", async () => {
    const national = freshPhone();
    await sendOtp(national);
    for (const code of ["12345", "1234567", "abcdef", ""]) {
      const reply = await verify(national, code);
      expect(reply.status).toBe(400);
      expect(reply.body.code).toBe("INVALID_INPUT");
    }
  });
});
