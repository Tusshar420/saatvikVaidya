import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * WCAG A/AA violations as a compact list, so failures read well (set
 * AXE_DETAILS=1 to include axe's reason for each node). The logo
 * ([data-logo]) is skipped: its brand colours are a logotype, which WCAG
 * 1.4.3 exempts from contrast minimums.
 */
export async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude("[data-logo]")
    .analyze();
  return results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) =>
      process.env.AXE_DETAILS
        ? `${n.target.join(" ")}: ${n.failureSummary}`
        : n.target.join(" "),
    ),
  }));
}

/** Pixels the page scrolls sideways (should be 0). */
export async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

/** Collects console errors and uncaught exceptions for the page. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
