import { describe, expect, it } from "vitest";
import { splitLinks } from "./threads";

// Pasted links in thread text: found, cleaned of sentence punctuation, and
// only ever http or https.

describe("splitLinks", () => {
  it("leaves text without links alone", () => {
    expect(splitLinks("No links here.")).toEqual([{ type: "text", value: "No links here." }]);
  });

  it("finds http, https and www links in running text", () => {
    expect(splitLinks("See https://example.com/a?b=1 and www.ayush.gov.in today")).toEqual([
      { type: "text", value: "See " },
      { type: "link", value: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { type: "text", value: " and " },
      { type: "link", value: "www.ayush.gov.in", href: "https://www.ayush.gov.in/" },
      { type: "text", value: " today" },
    ]);
  });

  it("keeps sentence punctuation and an outer bracket out of the link", () => {
    expect(splitLinks("(read http://a.org/x.)")).toEqual([
      { type: "text", value: "(read " },
      { type: "link", value: "http://a.org/x", href: "http://a.org/x" },
      { type: "text", value: ".)" },
    ]);
    expect(splitLinks("https://en.wikipedia.org/wiki/Neem_(tree)")[0]).toMatchObject({
      value: "https://en.wikipedia.org/wiki/Neem_(tree)",
    });
  });

  it("never links other schemes", () => {
    for (const text of ["javascript:alert(1)", "data:text/html,hi", "ftp://a.org"]) {
      expect(splitLinks(text)).toEqual([{ type: "text", value: text }]);
    }
  });
});
