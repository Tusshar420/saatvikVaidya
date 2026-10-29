import { describe, expect, it } from "vitest";
import { safeNextPath, signInPath } from "./auth-routes";
import { isIndianE164, toIndianE164 } from "./phone";

describe("toIndianE164", () => {
  it("accepts the usual ways of writing an Indian mobile", () => {
    for (const raw of [
      "9876543210",
      "98765 43210",
      "+91 98765 43210",
      "+91-98765-43210",
      "919876543210",
      "09876543210",
    ]) {
      expect(toIndianE164(raw), raw).toBe("+919876543210");
    }
  });

  it("refuses anything else", () => {
    for (const raw of [
      "",
      "12345",
      "5876543210",
      "98765432101",
      "+1 415 555 0100",
      "+44 7911 123456",
      "9198765432101",
    ]) {
      expect(toIndianE164(raw), raw).toBeNull();
    }
  });

  it("isIndianE164 matches only the stored form", () => {
    expect(isIndianE164("+919876543210")).toBe(true);
    expect(isIndianE164("9876543210")).toBe(false);
    expect(isIndianE164("+915876543210")).toBe(false);
  });
});

describe("sign-in redirects", () => {
  it("keeps next only when it's a path on this site", () => {
    expect(signInPath("/account")).toBe("/?auth=sign-in&next=%2Faccount");
    expect(signInPath()).toBe("/?auth=sign-in");
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
    ]) {
      expect(safeNextPath(bad), bad).toBeNull();
      expect(signInPath(bad)).toBe("/?auth=sign-in");
    }
  });
});
