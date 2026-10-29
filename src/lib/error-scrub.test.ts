import { describe, expect, it } from "vitest";
import {
  deviceOf,
  fingerprintText,
  isBotAgent,
  isBrowserNoise,
  normalizeRoute,
  redacted,
  scrubText,
  scrubUrl,
  scrubValue,
  topFrame,
} from "./error-scrub";

describe("scrubText", () => {
  it.each([
    ['{"password":"hunter2","name":"Asha"}', "hunter2"],
    ["login failed password=hunter2 for user", "hunter2"],
    ["Authorization: Bearer abcdefghijklmnop", "abcdefghijklmnop"],
    ["cookie: better-auth.session_token=abc123xyz", "abc123xyz"],
    ["token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig_nature", "eyJhbGci"],
    ["card 4111 1111 1111 1111 declined", "4111"],
    ["card 4111-1111-1111-1111 declined", "4111"],
    ["pay to asha@okhdfcbank failed", "asha@okhdfcbank"],
    ["wrong otp 482913", "482913"],
    ["verification code: 7731", "7731"],
    ["cvv=123", "=123"],
  ])("removes the secret from %j", (input, secret) => {
    const out = scrubText(input);
    expect(out).not.toContain(secret);
    expect(out).toContain(redacted);
  });

  it("keeps ordinary text and email addresses", () => {
    const text = "TypeError: Cannot read properties of undefined (reading 'name') for a@example.com";
    expect(scrubText(text)).toBe(text);
  });

  it("caps very long text", () => {
    expect(scrubText("x".repeat(10_000), 100).length).toBeLessThanOrEqual(101);
  });
});

describe("scrubUrl", () => {
  it("drops the fragment and redacts sensitive query values", () => {
    const url = scrubUrl("https://shop.example/checkout?token=abc&step=2&otp=1234#frag");
    expect(url).not.toContain("abc");
    expect(url).not.toContain("1234");
    expect(url).not.toContain("frag");
    expect(url).toContain("step=2");
  });

  it("removes link tokens from the path", () => {
    expect(scrubUrl("/reset-password/Abc123Def456Ghi789Jkl012Mno345")).toBe("/reset-password/:token");
    expect(scrubUrl("/admin-invite/secret-token-value?x=1")).toBe("/admin-invite/:token?x=1");
  });
});

describe("scrubValue", () => {
  it("redacts sensitive keys at any depth and scrubs strings", () => {
    const out = scrubValue({
      orderId: "o1",
      password: "p",
      nested: { Authorization: "Bearer x1234567890", ok: "fine", upiId: "a@ybl" },
      note: "otp 123456",
    }) as Record<string, unknown>;
    expect(out.password).toBe(redacted);
    expect(out.nested).toEqual({ Authorization: redacted, ok: "fine", upiId: redacted });
    expect(out.note).toBe(`otp ${redacted}`);
    expect(out.orderId).toBe("o1");
  });

  it("limits depth, array length and string length", () => {
    const deep = { a: { b: { c: { d: 1 } } } };
    expect(JSON.stringify(scrubValue(deep))).toContain("[truncated]");
    expect((scrubValue(Array.from({ length: 50 }, (_, i) => i)) as number[]).length).toBe(10);
    expect((scrubValue("y".repeat(2000)) as string).length).toBeLessThanOrEqual(501);
  });
});

describe("fingerprints", () => {
  const stackA = "Error: x\n    at placeOrder (/app/.next/server/chunks/ab12cd34ef56.js:10:20)";
  const stackB = "Error: x\n    at placeOrder (/app/.next/server/chunks/99887766aabb.js:77:5)";
  const base = { source: "server", message: "Order 41 failed", stack: stackA, route: "/orders/41" } as const;

  it("ignores ids, line numbers and build hashes", () => {
    expect(fingerprintText(base)).toBe(
      fingerprintText({ ...base, message: "Order 42 failed", stack: stackB, route: "/orders/42" }),
    );
  });

  it("differs by source, message, top frame and route", () => {
    const f = fingerprintText(base);
    expect(fingerprintText({ ...base, source: "browser" })).not.toBe(f);
    expect(fingerprintText({ ...base, message: "Payment failed" })).not.toBe(f);
    expect(fingerprintText({ ...base, stack: "Error\n    at other (/app/x.js:1:1)" })).not.toBe(f);
    expect(fingerprintText({ ...base, route: "/cart" })).not.toBe(f);
  });

  it("normalises routes", () => {
    expect(normalizeRoute("https://x.test/orders/123?a=1#h")).toBe("/orders/:id");
    expect(normalizeRoute("/products/punarnava")).toBe("/products/punarnava");
    expect(normalizeRoute("/app/orders/[id]")).toBe("/app/orders/[id]");
  });

  it("topFrame skips node internals", () => {
    expect(topFrame("Error\n    at node:internal/x (node:internal/x:1:1)\n    at f (/a/b.js:3:4)")).toBe("f (/a/b.js");
  });
});

describe("noise and devices", () => {
  it("flags extension, cross-origin and harmless errors", () => {
    expect(isBrowserNoise({ message: "ResizeObserver loop completed with undelivered notifications." })).toBe(true);
    expect(isBrowserNoise({ message: "Script error." })).toBe(true);
    expect(isBrowserNoise({ message: "boom", filename: "chrome-extension://abc/content.js" })).toBe(true);
    expect(isBrowserNoise({ message: "boom", stack: "Error\n at x (moz-extension://abc/a.js:1:1)" })).toBe(true);
    expect(isBrowserNoise({ message: "Cannot read properties of null" })).toBe(false);
  });

  it("recognises bots and devices", () => {
    expect(isBotAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isBotAgent("HeadlessChrome/120")).toBe(true);
    expect(isBotAgent("")).toBe(true);
    const phone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Mobile/15E148 Safari/604.1";
    expect(isBotAgent(phone)).toBe(false);
    expect(deviceOf(phone)).toBe("mobile");
    expect(deviceOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36")).toBe("desktop");
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/604.1")).toBe("tablet");
  });
});
