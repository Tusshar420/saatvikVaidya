// The date filters on /orders ("This month", "This year"...). Periods follow
// India time, so an order placed at 1 am IST on 1 November counts in
// November even though it is still 31 October in UTC.

export const ORDER_RANGES = ["all", "month", "3months", "year", "lastyear"] as const;
export type OrderRange = (typeof ORDER_RANGES)[number];

/** India is UTC+5:30 all year (no daylight saving). */
const IST_OFFSET_MS = 330 * 60_000;

/** A `?range=` value from the URL, or "all" for anything else. */
export function parseOrderRange(value: string | string[] | undefined): OrderRange {
  const raw = Array.isArray(value) ? value[0] : value;
  return (ORDER_RANGES as readonly string[]).includes(raw ?? "") ? (raw as OrderRange) : "all";
}

/** The instant midnight starts in India on this calendar day (month may overflow). */
const istMidnight = (year: number, month: number, day = 1) =>
  new Date(Date.UTC(year, month, day) - IST_OFFSET_MS);

/**
 * When a period starts (inclusive) and ends (exclusive). "Last 3 months" is
 * this month and the two before it, like the order filters on big stores.
 */
export function orderRangeBounds(range: OrderRange, now = new Date()): { from?: Date; to?: Date } {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth();
  switch (range) {
    case "all":
      return {};
    case "month":
      return { from: istMidnight(year, month) };
    case "3months":
      return { from: istMidnight(year, month - 2) };
    case "year":
      return { from: istMidnight(year, 0) };
    case "lastyear":
      return { from: istMidnight(year - 1, 0), to: istMidnight(year, 0) };
  }
}

/** The /orders link for a period and page; the defaults are left out. */
export function ordersHref(range: OrderRange, page = 1): string {
  const params = new URLSearchParams();
  if (range !== "all") params.set("range", range);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/orders?${query}` : "/orders";
}
