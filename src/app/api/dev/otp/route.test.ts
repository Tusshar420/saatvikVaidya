import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDevOtpVisible } from "@/server/env";
import { devLogNotifier } from "@/server/notify";
import { sendOtpSms } from "@/server/notify/auth";
import { clearDevOtps } from "@/server/notify/dev-outbox";
import { GET } from "./route";

const url = (phone: string) =>
  new Request(
    `http://localhost:3000/api/dev/otp?phone=${encodeURIComponent(phone)}`,
  );

beforeEach(() => {
  clearDevOtps();
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("isDevOtpVisible", () => {
  it("is on only outside production with DEV_SHOW_OTP=true", () => {
    expect(
      isDevOtpVisible({ NODE_ENV: "development", DEV_SHOW_OTP: "true" }),
    ).toBe(true);
    expect(isDevOtpVisible({ NODE_ENV: "test", DEV_SHOW_OTP: "true" })).toBe(
      true,
    );
    expect(
      isDevOtpVisible({ NODE_ENV: "production", DEV_SHOW_OTP: "true" }),
    ).toBe(false);
    expect(
      isDevOtpVisible({ NODE_ENV: "development", DEV_SHOW_OTP: "false" }),
    ).toBe(false);
    expect(isDevOtpVisible({ NODE_ENV: "development" })).toBe(false);
  });
});

describe("dev notify sender", () => {
  it("prints OTP messages to the server log", async () => {
    const log = vi.mocked(console.info);
    await sendOtpSms("+919812345678", "482913", "sign-in");
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("sms to +919812345678"),
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("482913"));
  });

  it("keeps nothing for the UI unless DEV_SHOW_OTP is on", async () => {
    vi.stubEnv("DEV_SHOW_OTP", "false");
    await sendOtpSms("+919812345678", "482913", "sign-in");
    vi.stubEnv("DEV_SHOW_OTP", "true");
    const reply = await GET(url("9812345678")).json();
    expect(reply).toEqual({ otp: null });
  });
});

describe("GET /api/dev/otp", () => {
  it("returns the latest OTP for the phone when enabled", async () => {
    vi.stubEnv("DEV_SHOW_OTP", "true");
    await sendOtpSms("+919812345678", "111111", "sign-in");
    await sendOtpSms("+919812345678", "222222", "password-reset");
    await sendOtpSms("+919800000000", "333333", "sign-in");

    const response = GET(url("+91 98123 45678"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { otp } = await response.json();
    expect(otp).toMatchObject({ code: "222222", purpose: "password-reset" });
    expect(Date.parse(otp.expiresAt)).toBeGreaterThan(Date.now());
  });

  it("is a 404 in production, even with DEV_SHOW_OTP=true", async () => {
    vi.stubEnv("DEV_SHOW_OTP", "true");
    await sendOtpSms("+919812345678", "111111", "sign-in");
    vi.stubEnv("NODE_ENV", "production");
    expect(GET(url("9812345678")).status).toBe(404);
  });

  it("is a 404 when DEV_SHOW_OTP is off", () => {
    vi.stubEnv("DEV_SHOW_OTP", "false");
    expect(GET(url("9812345678")).status).toBe(404);
  });

  it("refuses a phone that isn't an Indian mobile", async () => {
    vi.stubEnv("DEV_SHOW_OTP", "true");
    expect(GET(url("12345")).status).toBe(400);
    expect(GET(new Request("http://localhost:3000/api/dev/otp")).status).toBe(
      400,
    );
  });

  it("doesn't return expired codes", async () => {
    vi.stubEnv("DEV_SHOW_OTP", "true");
    await devLogNotifier.send({
      channel: "sms",
      to: "+919812345678",
      text: "old",
      otp: {
        code: "999999",
        purpose: "sign-in",
        expiresAt: new Date(Date.now() - 1),
      },
    });
    expect(await GET(url("9812345678")).json()).toEqual({ otp: null });
  });
});
