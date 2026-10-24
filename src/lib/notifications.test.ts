import { describe, expect, it } from "vitest";
import { isNotificationFilter, isSitePath, timeAgo } from "./notifications";

describe("isSitePath", () => {
  it("allows paths on this site", () => {
    for (const href of ["/", "/orders/abc", "/my-brand/x?tab=proof", "/admin/approvals/detail/u%201"]) {
      expect(isSitePath(href)).toBe(true);
    }
  });

  it("refuses anything that could leave the site", () => {
    for (const href of [
      "",
      "orders",
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "javascript:alert(1)",
      "/ok\n//evil.test",
      "/tab\tthere",
      "/x y",
      `/${"a".repeat(300)}`,
    ]) {
      expect(isSitePath(href)).toBe(false);
    }
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const ago = (ms: number) => timeAgo(new Date(now.getTime() - ms), now);

  it("counts minutes, hours, yesterday, then shows the date", () => {
    expect(ago(20_000)).toBe("Just now");
    expect(ago(5 * 60_000)).toBe("5 min ago");
    expect(ago(3 * 3_600_000)).toBe("3 h ago");
    expect(ago(30 * 3_600_000)).toBe("Yesterday");
    expect(ago(5 * 86_400_000)).toBe("15 Oct");
  });
});

describe("isNotificationFilter", () => {
  it("knows the three filters only", () => {
    expect(["all", "unread", "read"].every(isNotificationFilter)).toBe(true);
    expect(isNotificationFilter("archived")).toBe(false);
    expect(isNotificationFilter(undefined)).toBe(false);
  });
});
