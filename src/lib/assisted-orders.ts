// Orders our staff prepare for customers: ids, paths and limits, shared by
// the pages (to check URL segments) and the server.

/** Prepared-order ids are 18 random bytes, base64url: 24 characters. */
export const assistedOrderIdPattern = /^[A-Za-z0-9_-]{24}$/;

export function isAssistedOrderId(value: unknown): value is string {
  return typeof value === "string" && assistedOrderIdPattern.test(value);
}

/** The customer's page for a prepared order (the link we send). */
export const preparedOrderPath = (id: string) => `/orders/prepared/${id}`;

/** How long the link works. */
export const ASSISTED_LINK_DAYS = 7;
/** How long a confirmation code works. */
export const ASSISTED_CODE_MINUTES = 10;
/** Wrong codes allowed before a new one must be sent. */
export const ASSISTED_CODE_TRIES = 5;
/** The most different products in one prepared order (as in a cart). */
export const ASSISTED_MAX_LINES = 50;

export const assistedCodePattern = /^\d{6}$/;

export type AssistedStatus = "open" | "placed" | "cancelled" | "expired";

/** The status to show: an open order past its link date has expired. */
export function assistedStatusOf(
  order: { status: "open" | "placed" | "cancelled"; expiresAt: Date },
  now: Date = new Date(),
): AssistedStatus {
  return order.status === "open" && order.expiresAt <= now ? "expired" : order.status;
}
