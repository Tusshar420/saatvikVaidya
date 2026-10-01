import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  PaymentProviderUnavailableError,
  type PaymentProvider,
} from "./types";

// PAYMENT_PROVIDER=test: no money moves. The payment screen offers "Simulate
// success" and "Simulate failure", and the browser's choice is the result.
//
// It refuses to run when NODE_ENV=production, so it can't go live by
// accident. The one exception is the local production build that Playwright
// tests against: it runs only if TEST_PAYMENTS_IN_LOCAL_BUILD=true *and* the
// site's own origin (BETTER_AUTH_URL) is localhost, which a live site never
// is.

type Env = Partial<
  Record<"NODE_ENV" | "TEST_PAYMENTS_IN_LOCAL_BUILD" | "BETTER_AUTH_URL", string>
>;

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    return localHosts.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** Whether the test provider may run with this environment. Read at call time. */
export function testPaymentsAllowed(env: Env = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env.TEST_PAYMENTS_IN_LOCAL_BUILD === "true" && isLocalOrigin(env.BETTER_AUTH_URL);
}

function assertAllowed(): void {
  if (!testPaymentsAllowed()) {
    throw new PaymentProviderUnavailableError(
      "The test payment provider is disabled in production. Set PAYMENT_PROVIDER to a real provider.",
    );
  }
}

/** The browser's choice on the test payment screen. */
export const testPaymentPayloadSchema = z.object({
  outcome: z.enum(["success", "failure"]),
});

export const testPaymentProvider: PaymentProvider = {
  name: "test",
  isAvailable: () => testPaymentsAllowed(),
  async createPayment() {
    assertAllowed();
    return { reference: `test_${randomBytes(12).toString("hex")}` };
  },
  async verifyPayment(reference, payload) {
    assertAllowed();
    const { outcome } = testPaymentPayloadSchema.parse(payload);
    return outcome === "success"
      ? { reference, outcome: "succeeded" }
      : { reference, outcome: "failed", failureReason: "declined" };
  },
};
