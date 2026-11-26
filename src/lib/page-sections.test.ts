import { describe, expect, it } from "vitest";
import { sectionOf } from "./page-sections";

describe("sectionOf", () => {
  it("maps site pages to their module", () => {
    expect(sectionOf("/")).toBe("home");
    expect(sectionOf("/?auth=sign-in")).toBe("home");
    expect(sectionOf("/products")).toBe("shop");
    expect(sectionOf("/products/ashwagandha-churna")).toBe("shop");
    expect(sectionOf("/search?q=triphala")).toBe("shop");
    expect(sectionOf("/checkout")).toBe("cart");
    expect(sectionOf("/launch/neem-tablets")).toBe("brand");
    expect(sectionOf("/my-brand")).toBe("brand");
    expect(sectionOf("/doctor-talk/12")).toBe("doctorTalk");
    expect(sectionOf("/doctor/courses")).toBe("courses");
    expect(sectionOf("/quiz/4")).toBe("quiz");
    expect(sectionOf("/track")).toBe("orders");
    expect(sectionOf("/privacy")).toBe("info");
  });

  it("doesn't count admin, API, sign-in links or unknown addresses", () => {
    expect(sectionOf("/admin")).toBeNull();
    expect(sectionOf("/admin/traffic")).toBeNull();
    expect(sectionOf("/api/page-views")).toBeNull();
    expect(sectionOf("/reset-password/abc")).toBeNull();
    expect(sectionOf("/admin-invite/abc")).toBeNull();
    expect(sectionOf("/wp-login.php")).toBeNull();
    expect(sectionOf("/constructor")).toBeNull();
    expect(sectionOf("//evil.example/products")).toBeNull();
    expect(sectionOf("https://evil.example/products")).toBeNull();
  });
});
