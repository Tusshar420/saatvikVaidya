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
import { isCommonPassword } from "./common-passwords";

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

const email = "reset@example.com";
const oldPassword = "Triphala-churna-5";
const newPassword = "Shatavari-roots-8";

async function signIn(password: string) {
  return callAuth("/sign-in/email", { email, password });
}

/** The token in the reset link emailed to `to`. */
function resetToken(to: string): string {
  const mail = sent.findLast(
    (message) => message.channel === "email" && message.to === to,
  );
  const url = mail?.text.match(/https?:\/\/\S+/)?.[0];
  if (!url) throw new Error(`No reset link was sent to ${to}`);
  const token = new URL(url).pathname.split("/").at(-1);
  if (!token) throw new Error(`No token in ${url}`);
  return token;
}

describe("password reset by email", () => {
  beforeEach(async () => {
    await callAuth("/sign-up/email", {
      name: "Reset Me",
      email,
      password: oldPassword,
      userTypeId: types.customer,
      termsAccepted: true,
    });
  });

  it("emails a one-time link that sets a new password and signs out other sessions", async () => {
    const session = await signIn(oldPassword);
    expect(session.sessionCookie).not.toBeNull();

    const request = await callAuth("/request-password-reset", {
      email: "Reset@Example.com",
      redirectTo: "/account",
    });
    expect(request.status).toBe(200);
    const mail = sent.at(-1);
    expect(mail).toMatchObject({ channel: "email", to: email });
    expect(mail?.text).toContain(
      "http://localhost:3000/api/auth/reset-password/",
    );

    const token = resetToken(email);
    const reset = await callAuth("/reset-password", { token, newPassword });
    expect(reset.status).toBe(200);

    expect((await signIn(oldPassword)).status).toBe(401);
    expect((await signIn(newPassword)).status).toBe(200);

    // The old session was revoked.
    const stale = await callAuth("/get-session", null, {
      method: "GET",
      cookie: session.sessionCookie!,
    });
    expect(stale.body).toBeNull();

    // The link works once.
    const again = await callAuth("/reset-password", {
      token,
      newPassword: "Another-new-one-4",
    });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe("INVALID_TOKEN");
  });

  it("applies the password rules to the new password", async () => {
    await callAuth("/request-password-reset", { email });
    const token = resetToken(email);
    for (const [candidate, code] of [
      ["short", "PASSWORD_TOO_SHORT"],
      ["iloveyou", "PASSWORD_TOO_COMMON"],
    ] as const) {
      const reply = await callAuth("/reset-password", {
        token,
        newPassword: candidate,
      });
      expect(reply.status).toBe(400);
      expect(reply.body.code).toBe(code);
    }
    // The link is still usable after a refused password.
    const reset = await callAuth("/reset-password", { token, newPassword });
    expect(reset.status).toBe(200);
  });

  it("refuses a made-up token", async () => {
    const reply = await callAuth("/reset-password", {
      token: "made-up-token",
      newPassword,
    });
    expect(reply.status).toBe(400);
    expect(reply.body.code).toBe("INVALID_TOKEN");
    expect((await signIn(oldPassword)).status).toBe(200);
  });

  it("only allows redirects back to this site", async () => {
    const reply = await callAuth("/request-password-reset", {
      email,
      redirectTo: "https://evil.example/steal",
    });
    expect(reply.status).toBe(400);
    expect(sent).toHaveLength(0);
  });
});

describe("password reset by phone OTP", () => {
  let national: string;

  beforeEach(async () => {
    national = freshPhone();
    await callAuth("/phone-number/send-otp", { phoneNumber: national });
    await callAuth("/phone-number/verify", {
      phoneNumber: national,
      code: lastOtp(sent, e164(national)),
      name: "Phone Reset",
      userTypeId: types.pharmacy,
      termsAccepted: true,
    });
  });

  it("sets a password with the SMS code, then phone + password sign-in works", async () => {
    const request = await callAuth("/phone-number/request-password-reset", {
      phoneNumber: national,
    });
    expect(request.status).toBe(200);
    const sms = sent.at(-1);
    expect(sms).toMatchObject({
      channel: "sms",
      to: e164(national),
      otp: { purpose: "password-reset" },
    });
    const otp = lastOtp(sent, e164(national));

    const wrong = await callAuth("/phone-number/reset-password", {
      phoneNumber: national,
      otp: wrongCode(otp),
      newPassword,
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe("INVALID_OTP");

    const reset = await callAuth("/phone-number/reset-password", {
      phoneNumber: national,
      otp,
      newPassword,
    });
    expect(reset.status).toBe(200);

    const signIn = await callAuth("/sign-in/phone-number", {
      phoneNumber: `+91${national}`,
      password: newPassword,
    });
    expect(signIn.status).toBe(200);
    expect(signIn.sessionCookie).not.toBeNull();

    // The code can't be used twice.
    const replay = await callAuth("/phone-number/reset-password", {
      phoneNumber: national,
      otp,
      newPassword: "Another-new-one-4",
    });
    expect(replay.status).toBe(400);
  });

  it("the sign-in code can't be used to reset the password", async () => {
    await callAuth("/phone-number/send-otp", { phoneNumber: national });
    const signInCode = lastOtp(sent, e164(national));
    const reply = await callAuth("/phone-number/reset-password", {
      phoneNumber: national,
      otp: signInCode,
      newPassword,
    });
    expect(reply.status).toBe(400);
  });

  it("refuses a common new password", async () => {
    await callAuth("/phone-number/request-password-reset", {
      phoneNumber: national,
    });
    const reply = await callAuth("/phone-number/reset-password", {
      phoneNumber: national,
      otp: lastOtp(sent, e164(national)),
      newPassword: "qwertyuiop",
    });
    expect(reply.status).toBe(400);
    expect(reply.body.code).toBe("PASSWORD_TOO_COMMON");
  });

  it("sends no email for a phone-only account", async () => {
    const user = await db.user.findUniqueOrThrow({
      where: { phoneNumber: e164(national) },
    });
    sent.length = 0;
    const reply = await callAuth("/request-password-reset", {
      email: user.email,
    });
    expect(reply.status).toBe(200);
    expect(sent).toHaveLength(0);
  });
});

describe("common password list", () => {
  it("knows common passwords, case-insensitively, and allows good ones", () => {
    for (const common of ["password", "12345678", "Qwerty123", "IloveYou"])
      expect(isCommonPassword(common), common).toBe(true);
    for (const fine of [oldPassword, newPassword, "correct horse battery"])
      expect(isCommonPassword(fine), fine).toBe(false);
  });
});
