// Order ids and numbers, shared by the pages (to check URL segments) and the
// server (to make them).

/** Order ids are 16 random bytes, base64url: 22 characters. */
export const orderIdPattern = /^[A-Za-z0-9_-]{22}$/;

export function isOrderId(value: unknown): value is string {
  return typeof value === "string" && orderIdPattern.test(value);
}

/** Crockford base32 without I, L, O and U, so numbers read out clearly. */
export const ORDER_NUMBER_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** "SV-" and 8 characters, e.g. "SV-7K2Q9F4M". */
export const orderNumberPattern = /^SV-[0-9A-HJKMNP-TV-Z]{8}$/;

/** The most units of one product per cart line (matches the server's limit). */
export const MAX_QUANTITY_INPUT = 9_999;

type StatusForPath =
  | "pending_payment"
  | "paid"
  | "payment_failed"
  | "cancelled"
  | "processing"
  | "shipped"
  | "delivered";

/** Where an order's buyer goes after checkout: pay, confirmation or failure. */
export function checkoutPathFor(orderId: string, status: StatusForPath): string {
  switch (status) {
    case "paid":
    case "processing":
    case "shipped":
    case "delivered":
      return `/checkout/confirmation/${orderId}`;
    case "payment_failed":
      return `/checkout/failed/${orderId}`;
    case "pending_payment":
    case "cancelled":
      return `/checkout/pay/${orderId}`;
  }
}
