import { describe, expect, it } from "vitest";
import { cn } from "./cn";
import { isDesignPageEnabled } from "./flags";
import { formatINR, formatNumber, initialsOf } from "./format";
import { passwordStrength } from "./password-strength";
import {
  formatIndianPhone,
  isValidIndianMobile,
  normalizeIndianPhone,
  telHref,
} from "./phone";

describe("normalizeIndianPhone", () => {
  it.each([
    ["9220358400", "9220358400"],
    ["+91 92203 58400", "9220358400"],
    ["91-9220358400", "9220358400"],
    ["09220358400", "9220358400"],
    ["92203 5840099", "9220358400"],
    ["abc", ""],
    ["9122", "9122"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeIndianPhone(input)).toBe(expected);
  });

  it("validates and formats a mobile number", () => {
    expect(isValidIndianMobile("9220358400")).toBe(true);
    expect(isValidIndianMobile("1220358400")).toBe(false);
    expect(isValidIndianMobile("922035840")).toBe(false);
    expect(formatIndianPhone("9220358400")).toBe("+91 92203 58400");
  });

  it("builds a tel: link from a displayed number", () => {
    expect(telHref("+91 92203 58400")).toBe("tel:+919220358400");
  });
});

describe("format", () => {
  it("uses Indian digit grouping", () => {
    expect(formatNumber(125000)).toBe("1,25,000");
    expect(formatINR(10000)).toBe("₹10,000");
  });

  it("takes initials from the first and last name", () => {
    expect(initialsOf("Abhishek Sharma")).toBe("AS");
    expect(initialsOf("Dr. Abhishek Kumar Sharma")).toBe("DS");
    expect(initialsOf("meera")).toBe("ME");
    expect(initialsOf("  ")).toBe("?");
  });
});

describe("passwordStrength", () => {
  it.each([
    ["", "empty"],
    ["abc123", "weak"],
    ["abcdefgh", "weak"],
    ["abcdefg1", "fair"],
    ["Abcdefg1!", "strong"],
    ["correct horse battery", "fair"],
    ["Correct horse battery 9", "strong"],
  ] as const)("%j is %s", (password, expected) => {
    expect(passwordStrength(password)).toBe(expected);
  });
});

describe("isDesignPageEnabled", () => {
  it("is on in development", () => {
    expect(isDesignPageEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("is off in production unless SHOW_DESIGN_PAGE is exactly true", () => {
    expect(isDesignPageEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(
      isDesignPageEnabled({ NODE_ENV: "production", SHOW_DESIGN_PAGE: "1" }),
    ).toBe(false);
    expect(
      isDesignPageEnabled({ NODE_ENV: "production", SHOW_DESIGN_PAGE: "true" }),
    ).toBe(true);
  });
});

describe("cn", () => {
  it("keeps custom text sizes next to text colours", () => {
    expect(cn("text-h2 text-ink", "text-teal")).toBe("text-h2 text-teal");
  });

  it("lets a caller override a token-based class", () => {
    expect(cn("shadow-card rounded-xl", "shadow-raised rounded-lg")).toBe(
      "shadow-raised rounded-lg",
    );
    expect(cn("bg-surface bg-hero")).toBe("bg-surface bg-hero");
  });
});
