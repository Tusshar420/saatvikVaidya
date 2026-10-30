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
import { userTypeSeed } from "@/server/seed/user-types";
import {
  callAuth,
  captureMessages,
  e164,
  freshPhone,
  lastOtp,
  resetAuthData,
  userTypeIds,
} from "../../../tests/setup/auth";
import { isPlaceholderEmail } from "./placeholder-email";
import { prepareNewUser } from "./user-fields";

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

const password = "Neem-leaf-tea-42";

function emailSignUp(overrides: Record<string, unknown> = {}) {
  return {
    name: "Asha Gupta",
    email: `asha.${Math.random().toString(36).slice(2)}@example.com`,
    password,
    userTypeId: types.customer,
    termsAccepted: true,
    ...overrides,
  };
}

/** Sends an OTP to `national` (typed as `typed`) and returns the code. */
async function sendOtp(national: string, typed = national): Promise<string> {
  const reply = await callAuth("/phone-number/send-otp", {
    phoneNumber: typed,
  });
  expect(reply.status).toBe(200);
  return lastOtp(sent, e164(national));
}

describe("email + password sign-up", () => {
  it.each(userTypeSeed.map((type) => [type.key, type.requiresVerification]))(
    "creates a %s account with the right verification status",
    async (key, requiresVerification) => {
      const input = emailSignUp({
        userTypeId: types[key],
        email: `New.${key}@Example.com`,
        marketingOptIn: true,
      });
      const before = Date.now();
      const reply = await callAuth("/sign-up/email", input);

      expect(reply.status).toBe(200);
      // The reply is the same for new and existing emails, and never signs in.
      expect(reply.body).toEqual({ status: true });
      expect(reply.sessionCookie).toBeNull();

      const user = await db.user.findUniqueOrThrow({
        where: { email: `new.${key}@example.com` },
      });
      expect(user).toMatchObject({
        name: "Asha Gupta",
        userTypeId: types[key],
        role: "user",
        verificationStatus: requiresVerification ? "pending" : "none",
        marketingOptIn: true,
        emailVerified: false,
        phoneNumber: null,
      });
      expect(user.termsAcceptedAt.getTime()).toBeGreaterThanOrEqual(
        before - 1000,
      );

      const signIn = await callAuth("/sign-in/email", {
        email: `new.${key}@example.com`,
        password,
      });
      expect(signIn.status).toBe(200);
      expect(signIn.sessionCookie).not.toBeNull();
    },
  );

  it("sends a welcome email to a new account, and only the usual notice to an existing one", async () => {
    const input = emailSignUp();
    await callAuth("/sign-up/email", input);
    const welcome = sent.filter((message) => message.channel === "email" && message.to === input.email);
    expect(welcome).toHaveLength(1);
    expect(welcome[0]).toMatchObject({ subject: "Welcome to Saatvik Vaidya" });
    expect(welcome[0]?.channel === "email" && welcome[0].html).toContain("Namaste Asha Gupta,");

    // Signing up again with the same email sends one email too (no hint that the account exists).
    sent.length = 0;
    await callAuth("/sign-up/email", input);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ subject: "Someone tried to register with your email" });
  });

  it("defaults marketingOptIn to false", async () => {
    const input = emailSignUp();
    await callAuth("/sign-up/email", input);
    const user = await db.user.findUniqueOrThrow({
      where: { email: input.email },
    });
    expect(user.marketingOptIn).toBe(false);
  });

  it.each([
    ["missing", {}],
    ["false", { termsAccepted: false }],
    ["a string", { termsAccepted: "yes" }],
  ])("refuses sign-up with terms %s", async (_, terms) => {
    const input = { ...emailSignUp(), termsAccepted: undefined, ...terms };
    const reply = await callAuth("/sign-up/email", input);
    expect(reply.status).toBe(400);
    expect(reply.body.code).toBe("TERMS_NOT_ACCEPTED");
    expect(await db.user.count()).toBe(0);
  });

  it("refuses an inactive or unknown user type", async () => {
    await db.userType.update({
      where: { id: types.doctor },
      data: { active: false },
    });
    for (const userTypeId of [types.doctor, 99_999, 0, "1"]) {
      const reply = await callAuth(
        "/sign-up/email",
        emailSignUp({ userTypeId }),
      );
      expect(reply.status).toBe(400);
      expect(["INVALID_USER_TYPE", "INVALID_INPUT"]).toContain(reply.body.code);
    }
    const missing = await callAuth(
      "/sign-up/email",
      emailSignUp({ userTypeId: undefined }),
    );
    expect(missing.status).toBe(400);
    expect(await db.user.count()).toBe(0);
  });

  it("refuses emails on the phone-account placeholder domain", async () => {
    const reply = await callAuth(
      "/sign-up/email",
      emailSignUp({ email: "919876543210@phone.saatvikvaidya.invalid" }),
    );
    expect(reply.status).toBe(400);
    expect(reply.body.code).toBe("INVALID_EMAIL");
  });

  it("refuses short, overlong and common passwords", async () => {
    const cases = [
      ["short1!", "PASSWORD_TOO_SHORT"],
      ["x".repeat(129), "PASSWORD_TOO_LONG"],
      ["password123", "PASSWORD_TOO_COMMON"],
      ["Sunshine1", "PASSWORD_TOO_COMMON"],
      ["Saatvik@123", "PASSWORD_TOO_COMMON"],
    ] as const;
    for (const [candidate, code] of cases) {
      const reply = await callAuth(
        "/sign-up/email",
        emailSignUp({ password: candidate }),
      );
      expect(reply.status, candidate).toBe(400);
      expect(reply.body.code, candidate).toBe(code);
    }
    expect(await db.user.count()).toBe(0);
  });
});

describe("phone OTP sign-up", () => {
  it.each(userTypeSeed.map((type) => [type.key, type.requiresVerification]))(
    "creates a %s account once the OTP and details are in",
    async (key, requiresVerification) => {
      const national = freshPhone();
      const code = await sendOtp(
        national,
        `+91 ${national.slice(0, 5)} ${national.slice(5)}`,
      );

      // Right code, no details yet: ask for them, without using up the code.
      const first = await callAuth("/phone-number/verify", {
        phoneNumber: national,
        code,
      });
      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({
        status: false,
        registrationRequired: true,
      });
      expect(first.sessionCookie).toBeNull();
      expect(await db.user.count()).toBe(0);

      const second = await callAuth("/phone-number/verify", {
        phoneNumber: national,
        code,
        name: "Dr. Meera Iyer",
        userTypeId: types[key],
        termsAccepted: true,
      });
      expect(second.status).toBe(200);
      expect(second.body.status).toBe(true);
      expect(second.sessionCookie).not.toBeNull();

      const user = await db.user.findUniqueOrThrow({
        where: { phoneNumber: e164(national) },
      });
      expect(user).toMatchObject({
        name: "Dr. Meera Iyer",
        phoneNumberVerified: true,
        userTypeId: types[key],
        role: "user",
        verificationStatus: requiresVerification ? "pending" : "none",
        marketingOptIn: false,
      });
      expect(isPlaceholderEmail(user.email)).toBe(true);

      // The code is used up now.
      const replay = await callAuth("/phone-number/verify", {
        phoneNumber: national,
        code,
      });
      expect(replay.status).toBe(400);
    },
  );

  it("signs an existing number straight in, ignoring registration fields", async () => {
    const national = freshPhone();
    let code = await sendOtp(national);
    await callAuth("/phone-number/verify", {
      phoneNumber: national,
      code,
      name: "Ravi Kumar",
      userTypeId: types.pharmacy,
      termsAccepted: true,
    });

    code = await sendOtp(national);
    const reply = await callAuth("/phone-number/verify", {
      phoneNumber: `0${national}`,
      code,
      name: "Someone Else",
      userTypeId: types.customer,
      termsAccepted: true,
    });
    expect(reply.status).toBe(200);
    expect(reply.body.status).toBe(true);
    expect(reply.sessionCookie).not.toBeNull();
    const users = await db.user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      name: "Ravi Kumar",
      userTypeId: types.pharmacy,
    });
  });

  it("keeps the code usable when the details are invalid", async () => {
    const national = freshPhone();
    const code = await sendOtp(national);
    const bad = await callAuth("/phone-number/verify", {
      phoneNumber: national,
      code,
      name: "Ravi Kumar",
      userTypeId: types.customer,
      termsAccepted: false,
    });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe("TERMS_NOT_ACCEPTED");

    const inactive = await db.userType.update({
      where: { id: types.stockist },
      data: { active: false },
    });
    const badType = await callAuth("/phone-number/verify", {
      phoneNumber: national,
      code,
      name: "Ravi Kumar",
      userTypeId: inactive.id,
      termsAccepted: true,
    });
    expect(badType.status).toBe(400);
    expect(badType.body.code).toBe("INVALID_USER_TYPE");

    const good = await callAuth("/phone-number/verify", {
      phoneNumber: national,
      code,
      name: "Ravi Kumar",
      userTypeId: types.customer,
      termsAccepted: true,
    });
    expect(good.status).toBe(200);
    expect(good.body.status).toBe(true);
  });

  it("only accepts Indian mobile numbers", async () => {
    for (const phoneNumber of [
      "12345",
      "5876543210",
      "+1 415 555 0100",
      "+44 7911 123456",
      "98765432101",
    ]) {
      const reply = await callAuth("/phone-number/send-otp", { phoneNumber });
      expect(reply.status, phoneNumber).toBe(400);
      expect(reply.body.code, phoneNumber).toBe("INVALID_PHONE_NUMBER");
    }
    expect(sent).toHaveLength(0);
  });
});

describe("role can't be escalated from input", () => {
  it("refuses role and other server-set fields at email sign-up", async () => {
    for (const extra of [
      { role: "admin" },
      { verificationStatus: "approved" },
      { termsAcceptedAt: "2020-01-01T00:00:00.000Z" },
      { emailVerified: true },
      { phoneNumber: "+919876543210" },
    ]) {
      const reply = await callAuth("/sign-up/email", emailSignUp(extra));
      expect(reply.status, JSON.stringify(extra)).toBe(400);
    }
    expect(await db.user.count()).toBe(0);
  });

  it("refuses role at phone sign-up", async () => {
    const national = freshPhone();
    const code = await sendOtp(national);
    const reply = await callAuth("/phone-number/verify", {
      phoneNumber: national,
      code,
      name: "Ravi Kumar",
      userTypeId: types.customer,
      termsAccepted: true,
      role: "admin",
    });
    expect(reply.status).toBe(400);
    expect(await db.user.count()).toBe(0);
  });

  it("refuses role, type and status changes on update-user", async () => {
    const input = emailSignUp();
    await callAuth("/sign-up/email", input);
    const { sessionCookie } = await callAuth("/sign-in/email", {
      email: input.email,
      password,
    });
    expect(sessionCookie).not.toBeNull();

    for (const change of [
      { role: "admin" },
      { verificationStatus: "approved" },
      { userTypeId: types.doctor },
      { phoneNumber: null },
    ]) {
      const reply = await callAuth("/update-user", change, {
        cookie: sessionCookie!,
      });
      expect(reply.status, JSON.stringify(change)).toBe(400);
    }
    const allowed = await callAuth(
      "/update-user",
      { name: "Asha G.", marketingOptIn: true },
      { cookie: sessionCookie! },
    );
    expect(allowed.status).toBe(200);

    const user = await db.user.findUniqueOrThrow({
      where: { email: input.email },
    });
    expect(user).toMatchObject({
      name: "Asha G.",
      marketingOptIn: true,
      role: "user",
      verificationStatus: "none",
      userTypeId: types.customer,
    });
  });

  it("the create hook always sets role user, whatever it's given", async () => {
    const { data } = await prepareNewUser(
      { email: "x@example.com", role: "admin", verificationStatus: "approved" },
      {
        name: "Asha",
        userTypeId: types.doctor,
        termsAccepted: true,
      },
    );
    expect(data).toMatchObject({
      role: "user",
      verificationStatus: "pending",
      userTypeId: types.doctor,
      marketingOptIn: false,
    });
    await expect(
      prepareNewUser({ email: "x@example.com" }, undefined),
    ).rejects.toMatchObject({ body: { code: "INVALID_INPUT" } });
  });
});
