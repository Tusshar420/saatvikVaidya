import { afterEach, describe, expect, it, vi } from "vitest";
import { getPaymentProvider, getPaymentProviderByName, paymentsAvailable, PaymentProviderUnavailableError } from "./index";
import { testPaymentProvider, testPaymentsAllowed } from "./test-provider";

// The test payment provider never runs on a live site (P1.4).

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("testPaymentsAllowed", () => {
  it("runs outside production", () => {
    expect(testPaymentsAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(testPaymentsAllowed({ NODE_ENV: "test" })).toBe(true);
  });

  it("refuses in production", () => {
    expect(testPaymentsAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(
      testPaymentsAllowed({ NODE_ENV: "production", BETTER_AUTH_URL: "http://localhost:3100" }),
    ).toBe(false);
  });

  it("runs in a production build only with the flag and a localhost origin", () => {
    const flag = { NODE_ENV: "production", TEST_PAYMENTS_IN_LOCAL_BUILD: "true" };
    expect(testPaymentsAllowed({ ...flag, BETTER_AUTH_URL: "http://localhost:3100" })).toBe(true);
    expect(testPaymentsAllowed({ ...flag, BETTER_AUTH_URL: "http://127.0.0.1:3100" })).toBe(true);
    expect(testPaymentsAllowed({ ...flag, BETTER_AUTH_URL: "https://saatvikvaidya.com" })).toBe(false);
    expect(testPaymentsAllowed({ ...flag, BETTER_AUTH_URL: "https://localhost.evil.com" })).toBe(false);
    expect(testPaymentsAllowed({ ...flag })).toBe(false);
    expect(testPaymentsAllowed({ ...flag, BETTER_AUTH_URL: "not a url" })).toBe(false);
  });
});

describe("testPaymentProvider", () => {
  it("makes a unique reference and turns the simulated choice into a result", async () => {
    const input = { orderId: "o", orderNumber: "SV-1", amountPaise: 100, attempt: 1 };
    const a = await testPaymentProvider.createPayment(input);
    const b = await testPaymentProvider.createPayment(input);
    expect(a.reference).toMatch(/^test_[0-9a-f]{24}$/);
    expect(a.reference).not.toBe(b.reference);
    await expect(testPaymentProvider.verifyPayment("r", { outcome: "success" })).resolves.toEqual({
      reference: "r",
      outcome: "succeeded",
    });
    await expect(testPaymentProvider.verifyPayment("r", { outcome: "failure" })).resolves.toEqual({
      reference: "r",
      outcome: "failed",
      failureReason: "declined",
    });
    await expect(testPaymentProvider.verifyPayment("r", { outcome: "maybe" })).rejects.toThrow();
  });

  it("refuses to create or verify payments in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(paymentsAvailable()).toBe(false);
    await expect(
      testPaymentProvider.createPayment({ orderId: "o", orderNumber: "SV-1", amountPaise: 1, attempt: 1 }),
    ).rejects.toBeInstanceOf(PaymentProviderUnavailableError);
    await expect(
      testPaymentProvider.verifyPayment("r", { outcome: "success" }),
    ).rejects.toBeInstanceOf(PaymentProviderUnavailableError);
  });
});

describe("getPaymentProvider", () => {
  it("defaults to the test provider and rejects unknown names", () => {
    expect(getPaymentProvider({}).name).toBe("test");
    expect(getPaymentProvider({ PAYMENT_PROVIDER: "test" }).name).toBe("test");
    expect(() => getPaymentProvider({ PAYMENT_PROVIDER: "razorpay" })).toThrow(/Unknown/);
  });
});

describe("getPaymentProviderByName", () => {
  it("finds the provider stored on a payment, whatever PAYMENT_PROVIDER is now", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "test");
    expect(getPaymentProviderByName("manual").name).toBe("manual");
    expect(getPaymentProviderByName("test").name).toBe("test");
    expect(() => getPaymentProviderByName("razorpay")).toThrow(/Unknown/);
    expect(() => getPaymentProviderByName("")).toThrow(/Unknown/);
  });
});
