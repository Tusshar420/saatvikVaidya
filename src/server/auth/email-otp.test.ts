import { randomInt } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { hashPassword } from "better-auth/crypto";
import type { Message } from "@/server/notify";
import { db } from "@/server/db";
import {
  callAuth,
  captureMessages,
  resetAuthData,
  userTypeIds,
  wrongCode,
} from "../../../tests/setup/auth";
import { otpPolicy } from "./policy";

// Email sign-in codes (Better Auth's email-otp plugin plus our policy
// plugin): the main sign-in method while phone sign-in is hidden.

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

const freshEmail = () => `otp-${Date.now()}-${randomInt(1_000_000)}@example.com`;
const identifier = (email: string) => `sign-in-otp-${email}`;

const registration = (userTypeId: number) => ({
  name: "Kavya Rao",
  userTypeId,
  termsAccepted: true,
});

/** Asks for a code and returns it (read from the email that was sent). */
async function sendCode(email: string): Promise<string> {
  const reply = await callAuth("/email-otp/send-verification-otp", {
    email,
    type: "sign-in",
  });
  expect(reply.status).toBe(200);
  const mail = sent.findLast(
    (message) => message.channel === "email" && message.to === email,
  );
  const code = mail?.channel === "email" ? /\b(\d{6})\b/.exec(mail.subject)?.[1] : undefined;
  if (!code) throw new Error(`No code was emailed to ${email}`);
  return code;
}

function signIn(email: string, otp: string, extra = {}) {
  return callAuth("/sign-in/email-otp", { email, otp, ...extra });
}

async function registeredEmail(): Promise<string> {
  const email = freshEmail();
  const reply = await signIn(email, await sendCode(email), registration(types.customer!));
  expect(reply.status).toBe(200);
  return email;
}

describe("email sign-in code", () => {
  it("is 6 digits, expires in 5 minutes and is emailed to the address", async () => {
    const email = freshEmail();
    const before = Date.now();
    const code = await sendCode(email);
    expect(code).toMatch(/^\d{6}$/);
    const mail = sent.at(-1);
    expect(mail?.channel === "email" && mail.text).toContain(code);

    const row = await db.verification.findFirstOrThrow({
      where: { identifier: identifier(email) },
    });
    const lifetime = row.expiresAt.getTime() - before;
    expect(lifetime).toBeGreaterThan(otpPolicy.expiresInSeconds * 1000 - 5000);
    expect(lifetime).toBeLessThanOrEqual(otpPolicy.expiresInSeconds * 1000 + 1000);
  });

  it("asks a new email for its details first, keeping the code valid", async () => {
    const email = freshEmail();
    const code = await sendCode(email);

    const first = await signIn(email, code);
    expect(first.status).toBe(200);
    expect(first.body.registrationRequired).toBe(true);
    expect(first.sessionCookie).toBeNull();
    expect(await db.user.count()).toBe(0);

    const second = await signIn(email, code, {
      ...registration(types.doctor!),
      marketingOptIn: true,
    });
    expect(second.status).toBe(200);
    expect(second.sessionCookie).not.toBeNull();
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({
      name: "Kavya Rao",
      emailVerified: true,
      role: "user",
      userTypeId: types.doctor,
      verificationStatus: "pending",
      marketingOptIn: true,
    });
    expect(user.termsAcceptedAt).not.toBeNull();
  });

  it("refuses a new account without accepted terms, or with an unknown type", async () => {
    const email = freshEmail();
    const code = await sendCode(email);
    const noTerms = await signIn(email, code, {
      ...registration(types.customer!),
      termsAccepted: false,
    });
    expect(noTerms.status).toBe(400);
    expect(noTerms.body.code).toBe("TERMS_NOT_ACCEPTED");
    const badType = await signIn(email, code, registration(999_999));
    expect(badType.status).toBe(400);
    expect(badType.body.code).toBe("INVALID_USER_TYPE");
    expect(await db.user.count()).toBe(0);
  });

  it("signs a known email straight in and ignores registration fields", async () => {
    const email = await registeredEmail();
    const reply = await signIn(email, await sendCode(email), {
      name: "Someone Else",
      userTypeId: types.doctor,
      termsAccepted: true,
    });
    expect(reply.status).toBe(200);
    expect(reply.sessionCookie).not.toBeNull();
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.name).toBe("Kavya Rao");
    expect(user.userTypeId).toBe(types.customer);
  });

  it("gives new and known emails the same reply when sending", async () => {
    const known = await registeredEmail();
    const replies = await Promise.all(
      [known, freshEmail()].map((email) =>
        callAuth("/email-otp/send-verification-otp", { email, type: "sign-in" }),
      ),
    );
    expect(replies.map((reply) => [reply.status, reply.body])).toEqual([
      [200, { success: true }],
      [200, { success: true }],
    ]);
  });

  it("allows 5 wrong attempts, then refuses even the right code", async () => {
    const email = freshEmail();
    const code = await sendCode(email);
    for (let attempt = 1; attempt <= otpPolicy.allowedAttempts; attempt++) {
      const reply = await signIn(email, wrongCode(code));
      expect(reply.status, `attempt ${attempt}`).toBe(400);
      expect(reply.body.code).toBe("INVALID_OTP");
    }
    const locked = await signIn(email, code, registration(types.customer!));
    expect(locked.status).toBe(403);
    expect(locked.body.code).toBe("TOO_MANY_ATTEMPTS");
    expect(locked.body.registrationRequired).toBeUndefined();
    expect(await db.user.count()).toBe(0);
  });

  it("refuses an expired code, for new and known emails alike", async () => {
    for (const email of [freshEmail(), await registeredEmail()]) {
      const code = await sendCode(email);
      await db.verification.updateMany({
        where: { identifier: identifier(email) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const reply = await signIn(email, code, registration(types.customer!));
      expect(reply.status).toBe(400);
      expect(reply.body.code).toBe("OTP_EXPIRED");
      expect(reply.sessionCookie).toBeNull();
    }
    expect(await db.user.count()).toBe(1);
  });

  it("refuses admins, who must use password and authenticator", async () => {
    const email = freshEmail();
    await db.user.create({
      data: {
        id: `admin-${randomInt(1_000_000)}`,
        name: "Admin",
        email,
        emailVerified: true,
        role: "admin",
        adminRole: "super",
        userTypeId: types.customer!,
        termsAcceptedAt: new Date(),
        accounts: {
          create: {
            id: `acc-${randomInt(1_000_000)}`,
            accountId: email,
            providerId: "credential",
            password: await hashPassword("a-long-admin-password"),
          },
        },
      },
    });
    const reply = await signIn(email, await sendCode(email));
    expect(reply.status).toBe(400);
    expect(reply.body.code).toBe("INVALID_OTP");
    expect(reply.sessionCookie).toBeNull();
  });

  it("refuses bad input: other code types, odd codes, unknown keys", async () => {
    const email = freshEmail();
    for (const type of ["forget-password", "email-verification"]) {
      const reply = await callAuth("/email-otp/send-verification-otp", { email, type });
      expect(reply.status).toBe(400);
    }
    await sendCode(email);
    for (const otp of ["12345", "1234567", "abcdef"]) {
      const reply = await signIn(email, otp);
      expect(reply.status).toBe(400);
      expect(reply.body.code).toBe("INVALID_INPUT");
    }
    const withRole = await signIn(email, "123456", { role: "admin" });
    expect(withRole.status).toBe(400);
    expect(withRole.body.code).toBe("INVALID_INPUT");
  });

  it("limits sends to one address: 3 per 10 minutes", async () => {
    const email = freshEmail();
    for (let send = 0; send < 3; send++) await sendCode(email);
    const reply = await callAuth("/email-otp/send-verification-otp", {
      email,
      type: "sign-in",
    });
    expect(reply.status).toBe(429);
    expect(reply.body.code).toBe("RATE_LIMITED");
  });
});
