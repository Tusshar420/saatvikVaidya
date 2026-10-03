import { describe, expect, it } from "vitest";
import { browserOf, countLinks, pagePathOf, parseSessionErrors } from "./bug-report";

describe("browserOf", () => {
  it("names common browsers and systems", () => {
    expect(
      browserOf("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"),
    ).toBe("Chrome 141 on Android");
    expect(
      browserOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
    ).toBe("Safari 17 on iOS");
    expect(
      browserOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0"),
    ).toBe("Edge 140 on Windows");
    expect(browserOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0")).toBe(
      "Firefox 131 on macOS",
    );
    expect(browserOf(null)).toBe("Unknown browser");
  });
});

describe("countLinks", () => {
  it("counts web links", () => {
    expect(countLinks("no links here")).toBe(0);
    expect(countLinks("see https://a.example and www.b.example or http://c.example")).toBe(3);
  });
});

describe("parseSessionErrors", () => {
  it("keeps valid entries only, the latest ten", () => {
    const entry = (n: number) => ({ message: `e${n}`, url: "/", kind: "error", at: n });
    const many = [...Array.from({ length: 12 }, (_, n) => entry(n)), { message: 1 }, "x"];
    const parsed = parseSessionErrors(JSON.stringify(many));
    expect(parsed).toHaveLength(10);
    expect(parsed[0]!.message).toBe("e2");
    expect(parseSessionErrors("{")).toEqual([]);
    expect(parseSessionErrors(JSON.stringify({ a: 1 }))).toEqual([]);
    expect(parseSessionErrors(undefined)).toEqual([]);
  });
});

describe("pagePathOf", () => {
  it("shows the path and query of a stored URL", () => {
    expect(pagePathOf("http://localhost:3000/orders/12?tab=a")).toBe("/orders/12?tab=a");
    expect(pagePathOf("/cart")).toBe("/cart");
  });
});
