// The payment provider interface (docs/CHUNKS.md, P1.4). Checkout talks only
// to this, so Razorpay can replace the test provider later without changes
// to checkout: it would create a Razorpay order in createPayment() and check
// the signature (or webhook) in verifyPayment().

export type PaymentProviderName = "test" | "manual" | "request";

export type CreatePaymentInput = {
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  /** 1 for the first attempt on the order, then 2, 3... */
  attempt: number;
};

/** What the provider says happened to a payment, once checked. */
export type VerifiedPayment = {
  reference: string;
  outcome: "succeeded" | "failed";
  /** Short reason for a failure, e.g. "declined". */
  failureReason?: string;
};

export type RefundPaymentInput = {
  /** The provider's reference of the payment that succeeded. */
  reference: string;
  amountPaise: number;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  /** False when the provider must not take payments here (see the test provider). */
  isAvailable(): boolean;
  /** Starts an attempt; returns the provider's reference for it. */
  createPayment(input: CreatePaymentInput): Promise<{ reference: string }>;
  /**
   * Checks the result the browser (or a webhook) reported for `reference`.
   * Throws if the payload isn't valid for this provider.
   */
  verifyPayment(reference: string, payload: unknown): Promise<VerifiedPayment>;
  /** Refunds a payment that succeeded (P2.2: a cancelled brand order); returns the refund's reference. */
  refundPayment(input: RefundPaymentInput): Promise<{ reference: string }>;
}

/** Thrown when a provider refuses to run (e.g. the test provider in production). */
export class PaymentProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentProviderUnavailableError";
  }
}
