import { afterEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail }) },
}));

import { devLogNotifier, getNotifier } from "./index";

afterEach(() => {
  vi.unstubAllEnvs();
  sendMail.mockReset();
});

describe("getNotifier", () => {
  it("uses the dev log when SMTP_HOST is not set", () => {
    vi.stubEnv("SMTP_HOST", "");
    expect(getNotifier()).toBe(devLogNotifier);
  });

  it("sends email through SMTP when configured", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("SMTP_USER", "no-reply@example.test");
    vi.stubEnv("SMTP_PASS", "secret");
    vi.stubEnv("EMAIL_FROM", "Saatvik Vaidya <no-reply@example.test>");
    await getNotifier().send({ channel: "email", to: "a@b.test", subject: "Hi", text: "Body" });
    expect(sendMail).toHaveBeenCalledWith({
      from: "Saatvik Vaidya <no-reply@example.test>",
      to: "a@b.test",
      subject: "Hi",
      text: "Body",
    });
  });

  it("does not throw when the mail server fails", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("EMAIL_FROM", "no-reply@example.test");
    sendMail.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      getNotifier().send({ channel: "email", to: "a@b.test", subject: "Hi", text: "Body" }),
    ).resolves.toBeUndefined();
  });
});
