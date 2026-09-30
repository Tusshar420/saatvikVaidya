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
  type AuthCall,
} from "../../../tests/setup/auth";

// Every reply here must be the same whether or not an account exists, so
// the API can't be used to find out who has an account.

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

const email = "member@example.com";
const password = "Ashwagandha-root-9";
let phone: string;

beforeEach(async () => {
  await callAuth("/sign-up/email", {
    name: "Member",
    email,
    password,
    userTypeId: types.customer,
    termsAccepted: true,
  });
  phone = freshPhone();
  await callAuth("/phone-number/send-otp", { phoneNumber: phone });
  await callAuth("/phone-number/verify", {
    phoneNumber: phone,
    code: lastOtp(sent, e164(phone)),
    name: "Phone Member",
    userTypeId: types.clinic,
    termsAccepted: true,
  });
  sent.length = 0;
});

/** Status and body, which must match between the two replies. */
function visible(reply: AuthCall) {
  return { status: reply.status, body: reply.body };
}

describe("generic replies", () => {
  it("email sign-in: unknown email and wrong password look the same", async () => {
    const wrong = await callAuth("/sign-in/email", {
      email,
      password: "Not-the-password-1",
    });
    const unknown = await callAuth("/sign-in/email", {
      email: "stranger@example.com",
      password: "Not-the-password-1",
    });
    expect(wrong.status).toBe(401);
    expect(visible(unknown)).toEqual(visible(wrong));
  });

  it("phone + password sign-in: unknown number, no password and wrong password look the same", async () => {
    // Give the phone account a password first (by reset).
    await callAuth("/phone-number/request-password-reset", {
      phoneNumber: phone,
    });
    await callAuth("/phone-number/reset-password", {
      phoneNumber: phone,
      otp: lastOtp(sent, e164(phone)),
      newPassword: password,
    });
    const passwordless = freshPhone();
    await callAuth("/phone-number/send-otp", { phoneNumber: passwordless });
    await callAuth("/phone-number/verify", {
      phoneNumber: passwordless,
      code: lastOtp(sent, e164(passwordless)),
      name: "No Password",
      userTypeId: types.customer,
      termsAccepted: true,
    });

    const attempt = (phoneNumber: string) =>
      callAuth("/sign-in/phone-number", {
        phoneNumber,
        password: "Not-the-password-1",
      });
    const wrong = await attempt(phone);
    const noPassword = await attempt(passwordless);
    const unknown = await attempt(freshPhone());
    expect(wrong.status).toBe(401);
    expect(visible(noPassword)).toEqual(visible(wrong));
    expect(visible(unknown)).toEqual(visible(wrong));

    const right = await callAuth("/sign-in/phone-number", {
      phoneNumber: phone,
      password,
    });
    expect(right.status).toBe(200);
  });

  it("email sign-up: an existing email gets the same reply, and the owner is told", async () => {
    const input = {
      name: "Someone",
      password: "Brahmi-leaf-oil-3",
      userTypeId: types.doctor,
      termsAccepted: true,
      marketingOptIn: true,
    };
    const existing = await callAuth("/sign-up/email", { ...input, email });
    const fresh = await callAuth("/sign-up/email", {
      ...input,
      email: "fresh@example.com",
    });
    expect(visible(existing)).toEqual(visible(fresh));
    expect(existing.body).toEqual({ status: true });
    expect(existing.sessionCookie).toBeNull();

    // The existing account is unchanged: old password works, new one doesn't.
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({ name: "Member", userTypeId: types.customer });
    const oldPassword = await callAuth("/sign-in/email", { email, password });
    expect(oldPassword.status).toBe(200);
    const newPassword = await callAuth("/sign-in/email", {
      email,
      password: input.password,
    });
    expect(newPassword.status).toBe(401);

    expect(sent).toContainEqual(
      expect.objectContaining({ channel: "email", to: email }),
    );
  });

  it("OTP send: same reply for a registered and an unknown number", async () => {
    const known = await callAuth("/phone-number/send-otp", {
      phoneNumber: phone,
    });
    const unknown = await callAuth("/phone-number/send-otp", {
      phoneNumber: freshPhone(),
    });
    expect(known.status).toBe(200);
    expect(visible(unknown)).toEqual(visible(known));
  });

  it("OTP verify: a wrong code looks the same for known and new numbers, with or without details", async () => {
    const other = freshPhone();
    const knownCode = await sendAndRead(phone);
    const newCode = await sendAndRead(other);
    const details = {
      name: "X",
      userTypeId: 99_999,
      termsAccepted: false,
    };

    const replies = [
      await callAuth("/phone-number/verify", {
        phoneNumber: phone,
        code: wrongCode(knownCode),
      }),
      await callAuth("/phone-number/verify", {
        phoneNumber: other,
        code: wrongCode(newCode),
      }),
      await callAuth("/phone-number/verify", {
        phoneNumber: phone,
        code: wrongCode(knownCode),
        ...details,
      }),
      await callAuth("/phone-number/verify", {
        phoneNumber: other,
        code: wrongCode(newCode),
        ...details,
      }),
    ];
    expect(replies[0]?.body.code).toBe("INVALID_OTP");
    for (const reply of replies)
      expect(visible(reply)).toEqual(visible(replies[0]!));
  });

  it("password reset by email: same reply for known and unknown emails", async () => {
    const known = await callAuth("/request-password-reset", { email });
    const unknown = await callAuth("/request-password-reset", {
      email: "stranger@example.com",
    });
    expect(known.status).toBe(200);
    expect(visible(unknown)).toEqual(visible(known));
    // Only the real account gets an email.
    expect(sent.map((message) => message.to)).toEqual([email]);
  });

  it("password reset by phone: same reply for known and unknown numbers", async () => {
    const stranger = freshPhone();
    const known = await callAuth("/phone-number/request-password-reset", {
      phoneNumber: phone,
    });
    const unknown = await callAuth("/phone-number/request-password-reset", {
      phoneNumber: stranger,
    });
    expect(known.status).toBe(200);
    expect(visible(unknown)).toEqual(visible(known));
    expect(sent.map((message) => message.to)).toEqual([e164(phone)]);

    // Guessing a reset code for an unknown number fails like a wrong code.
    const guess = await callAuth("/phone-number/reset-password", {
      phoneNumber: stranger,
      otp: "123456",
      newPassword: "Guessing-game-77",
    });
    const wrong = await callAuth("/phone-number/reset-password", {
      phoneNumber: phone,
      otp: wrongCode(lastOtp(sent, e164(phone))),
      newPassword: "Guessing-game-77",
    });
    expect(visible(guess)).toEqual(visible(wrong));
  });

  it("no error message mentions whether an account exists", async () => {
    const replies = [
      await callAuth("/sign-in/email", { email: "x@example.com", password }),
      await callAuth("/sign-in/phone-number", {
        phoneNumber: freshPhone(),
        password,
      }),
      await callAuth("/phone-number/verify", {
        phoneNumber: freshPhone(),
        code: "123456",
      }),
      await callAuth("/reset-password", {
        token: "not-a-token",
        newPassword: "Fresh-password-12",
      }),
    ];
    for (const reply of replies) {
      expect(reply.status).toBeGreaterThanOrEqual(400);
      expect(String(reply.body.message)).not.toMatch(
        /not found|no account|not registered|doesn't exist|does not exist|isn't registered/i,
      );
    }
  });
});

async function sendAndRead(national: string): Promise<string> {
  await callAuth("/phone-number/send-otp", { phoneNumber: national });
  return lastOtp(sent, e164(national));
}
