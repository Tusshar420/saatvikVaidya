import { describe, expect, it } from "vitest";
import { splitLinks } from "./courses";

describe("splitLinks", () => {
  it("turns web addresses into links and keeps the rest as text", () => {
    expect(splitLinks("Join on Zoom: https://zoom.us/j/123?pwd=a1. Starts 8 PM.")).toEqual([
      { text: "Join on Zoom: " },
      { text: "https://zoom.us/j/123?pwd=a1", href: "https://zoom.us/j/123?pwd=a1" },
      { text: ". Starts 8 PM." },
    ]);
  });

  it("leaves text without an http(s) address alone", () => {
    expect(splitLinks("Call 98765 43210. javascript:alert(1) www.example.com")).toEqual([
      { text: "Call 98765 43210. javascript:alert(1) www.example.com" },
    ]);
    expect(splitLinks("")).toEqual([]);
  });

  it("handles several links and line breaks", () => {
    expect(splitLinks("Day 1: http://a.test/x\nDay 2: (https://b.test/y)")).toEqual([
      { text: "Day 1: " },
      { text: "http://a.test/x", href: "http://a.test/x" },
      { text: "\nDay 2: (" },
      { text: "https://b.test/y", href: "https://b.test/y" },
      { text: ")" },
    ]);
  });
});
