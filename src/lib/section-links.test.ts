import { describe, expect, it } from "vitest";
import { pageForSectionLink, sectionHref } from "./section-links";

// Build Your Brand has its own page, so no link to it may be a homepage
// anchor (a "/#launch" link only scrolled the homepage).

describe("sectionHref", () => {
  it("opens the page for a section that has one", () => {
    expect(sectionHref("launch")).toBe("/launch");
  });

  it("jumps to the homepage section otherwise", () => {
    expect(sectionHref("brands")).toBe("/#brands");
    expect(sectionHref("quiz")).toBe("/#quiz");
  });
});

describe("pageForSectionLink", () => {
  it("points a homepage anchor at the section's page", () => {
    expect(pageForSectionLink("/#launch")).toBe("/launch");
    expect(pageForSectionLink("#launch")).toBe("/launch");
  });

  it("leaves other links alone", () => {
    for (const href of [
      "/launch",
      "/#brands",
      "/#launch-catalogue",
      "/coins",
      "/products?q=launch",
      "/coins#launch",
      "modal:sign-in",
    ]) {
      expect(pageForSectionLink(href)).toBe(href);
    }
  });
});
