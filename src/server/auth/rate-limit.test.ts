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
  freshIp,
  freshPhone,
  resetAuthData,
  userTypeIds,
} from "../../../tests/setup/auth";
import { rateLimitRules } from "./policy";
import { hitRateLimit, rateLimitKey } from "./rate-limit";

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

const password = "Tulsi-and-ginger-7";

async function createEmailUser(email: string): Promise<void> {
  const reply = await callAuth("/sign-up/email", {
    name: "Neha Singh",
    email,
    password,
    userTypeId: types.customer,
    termsAccepted: true,
  });
  expect(reply.status).toBe(200);
}

describe("hitRateLimit", () => {
  const rule = { name: "test", windowSeconds: 60, max: 2 };

  it("allows max requests per window, then refuses until it ends", async () => {
    const start = 1_800_000_000_000;
    expect(await hitRateLimit(rule, "a", start)).toMatchObject({
      allowed: true,
      remaining: 1,
      retryAfterSeconds: 60,
    });
    expect((await hitRateLimit(rule, "a", start + 1000)).allowed).toBe(true);
    const refused = await hitRateLimit(rule, "a", start + 30_000);
    expect(refused).toMatchObject({ allowed: false, remaining: 0 });
    expect(refused.retryAfterSeconds).toBe(30);

    // Other subjects have their own counters.
    expect((await hitRateLimit(rule, "b", start + 30_000)).allowed).toBe(true);

    // A new window starts once the old one ends.
    expect((await hitRateLimit(rule, "a", start + 60_000)).allowed).toBe(true);
  });

  it("counts concurrent requests exactly", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => hitRateLimit(rule, "burst")),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(2);
  });

  it("hashes long subjects to fit the key column", () => {
    const key = rateLimitKey(rule, `${"x".repeat(200)}@example.com`);
    expect(key.length).toBeLessThanOrEqual(191);
    expect(key).toMatch(/^test:sha256:[0-9a-f]{64}$/);
  });
});

describe("OTP send limits", () => {
  it("allows 3 sends per phone in 10 minutes, from any IP", async () => {
    const phoneNumber = freshPhone();
    for (let send = 1; send <= 3; send++) {
      const reply = await callAuth("/phone-number/send-otp", { phoneNumber });
      expect(reply.status, `send ${send}`).toBe(200);
    }
    const limited = await callAuth("/phone-number/send-otp", { phoneNumber });
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("RATE_LIMITED");
    const retryAfter = Number(limited.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(9 * 60);
    expect(retryAfter).toBeLessThanOrEqual(10 * 60);
    expect(sent).toHaveLength(3);

    // Password-reset codes count against the same phone.
    const reset = await callAuth("/phone-number/request-password-reset", {
      phoneNumber,
    });
    expect(reset.status).toBe(429);

    // Once the window has passed, sending works again.
    await db.authRateLimit.updateMany({
      data: { resetAtMs: BigInt(Date.now() - 1) },
    });
    const later = await callAuth("/phone-number/send-otp", { phoneNumber });
    expect(later.status).toBe(200);
  });

  it("allows 10 sends per IP in an hour", async () => {
    const ip = freshIp();
    for (let send = 1; send <= 10; send++) {
      const reply = await callAuth(
        "/phone-number/send-otp",
        { phoneNumber: freshPhone() },
        { ip },
      );
      expect(reply.status, `send ${send}`).toBe(200);
    }
    const limited = await callAuth(
      "/phone-number/send-otp",
      { phoneNumber: freshPhone() },
      { ip },
    );
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("RATE_LIMITED");
    const retryAfter = Number(limited.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(59 * 60);
    expect(sent).toHaveLength(10);

    // Another IP is unaffected.
    const other = await callAuth("/phone-number/send-otp", {
      phoneNumber: freshPhone(),
    });
    expect(other.status).toBe(200);
  });

  it("limits password-reset emails per address", async () => {
    const email = "limit@example.com";
    await createEmailUser(email);
    for (let send = 1; send <= 3; send++) {
      const reply = await callAuth("/request-password-reset", { email });
      expect(reply.status).toBe(200);
    }
    const limited = await callAuth("/request-password-reset", {
      email: "LIMIT@example.com",
    });
    expect(limited.status).toBe(429);
  });
});

describe("sign-in limit", () => {
  it("allows 10 attempts per IP in 15 minutes, even with the right password", async () => {
    const email = "signin-limit@example.com";
    await createEmailUser(email);
    const ip = freshIp();
    for (let attempt = 1; attempt <= 10; attempt++) {
      const reply = await callAuth(
        "/sign-in/email",
        { email, password: "wrong-password-1" },
        { ip },
      );
      expect(reply.status, `attempt ${attempt}`).toBe(401);
    }
    const limited = await callAuth(
      "/sign-in/email",
      { email, password },
      { ip },
    );
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("RATE_LIMITED");
    expect(limited.sessionCookie).toBeNull();
    const retryAfter = Number(limited.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(14 * 60);
    expect(retryAfter).toBeLessThanOrEqual(15 * 60);

    // OTP sign-in from the same IP is limited too.
    const otp = await callAuth(
      "/phone-number/verify",
      { phoneNumber: freshPhone(), code: "123456" },
      { ip },
    );
    expect(otp.status).toBe(429);
  });

  it("limits the same way whether or not the account exists", async () => {
    const email = "exists@example.com";
    await createEmailUser(email);
    const replies = [];
    for (const target of [email, "nobody@example.com"]) {
      const ip = freshIp();
      for (let attempt = 1; attempt <= 10; attempt++) {
        await callAuth(
          "/sign-in/email",
          { email: target, password: "x" },
          { ip },
        );
      }
      replies.push(
        await callAuth(
          "/sign-in/email",
          { email: target, password: "x" },
          { ip },
        ),
      );
    }
    expect(replies[0]?.status).toBe(429);
    expect(replies[1]?.status).toBe(429);
    expect(replies[0]?.body).toEqual(replies[1]?.body);
  });

  it("uses the limits from PLAN.md", () => {
    expect(rateLimitRules.otpSendPerPhone).toMatchObject({
      windowSeconds: 600,
      max: 3,
    });
    expect(rateLimitRules.messageSendPerIp).toMatchObject({
      windowSeconds: 3600,
      max: 10,
    });
    expect(rateLimitRules.signInPerIp).toMatchObject({
      windowSeconds: 900,
      max: 10,
    });
  });
});
