import { describe, expect, it } from "vitest";
import { orderRangeBounds, ordersHref, parseOrderRange } from "./order-ranges";

describe("parseOrderRange", () => {
  it("reads known periods and falls back to all orders", () => {
    expect(parseOrderRange("month")).toBe("month");
    expect(parseOrderRange(["lastyear", "month"])).toBe("lastyear");
    expect(parseOrderRange(undefined)).toBe("all");
    expect(parseOrderRange("week")).toBe("all");
    expect(parseOrderRange("toString")).toBe("all");
  });
});

describe("orderRangeBounds", () => {
  // 31 Oct 2026, 7:00 pm UTC = 1 Nov 2026, 12:30 am in India.
  const nov1Ist = new Date("2026-10-31T19:00:00Z");
  // 15 Feb 2026, noon in India.
  const feb = new Date("2026-02-15T06:30:00Z");

  it("follows India time at the start of a month", () => {
    expect(orderRangeBounds("month", nov1Ist)).toEqual({ from: new Date("2026-10-31T18:30:00Z") });
  });

  it("counts this month and the two before it as the last 3 months", () => {
    expect(orderRangeBounds("3months", nov1Ist)).toEqual({ from: new Date("2026-08-31T18:30:00Z") });
    // Across a year change: December to February.
    expect(orderRangeBounds("3months", feb)).toEqual({ from: new Date("2025-11-30T18:30:00Z") });
  });

  it("gives this year and the whole of last year", () => {
    expect(orderRangeBounds("year", feb)).toEqual({ from: new Date("2025-12-31T18:30:00Z") });
    expect(orderRangeBounds("lastyear", feb)).toEqual({
      from: new Date("2024-12-31T18:30:00Z"),
      to: new Date("2025-12-31T18:30:00Z"),
    });
    expect(orderRangeBounds("all", feb)).toEqual({});
  });
});

describe("ordersHref", () => {
  it("leaves out the defaults", () => {
    expect(ordersHref("all")).toBe("/orders");
    expect(ordersHref("all", 2)).toBe("/orders?page=2");
    expect(ordersHref("year")).toBe("/orders?range=year");
    expect(ordersHref("month", 3)).toBe("/orders?range=month&page=3");
  });
});
