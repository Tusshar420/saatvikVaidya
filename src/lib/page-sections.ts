// Traffic (/admin/traffic): which site module a page belongs to. Pure, so the
// browser tracker, the server and the tests share it. Labels are in
// src/content/traffic.ts.

export const pageSections = [
  "home",
  "shop",
  "cart",
  "brand",
  "courses",
  "doctorTalk",
  "quiz",
  "coins",
  "ebooks",
  "orders",
  "account",
  "feedback",
  "partner",
  "why",
  "info",
] as const;
export type PageSection = (typeof pageSections)[number];

/** The first part of the path → its module. Paths not listed are not counted. */
const sectionByFirstSegment: Record<string, PageSection> = {
  products: "shop",
  search: "shop",
  cart: "cart",
  checkout: "cart",
  launch: "brand",
  "my-brand": "brand",
  courses: "courses",
  doctor: "courses",
  "doctor-talk": "doctorTalk",
  quiz: "quiz",
  coins: "coins",
  ebooks: "ebooks",
  orders: "orders",
  track: "orders",
  account: "account",
  notifications: "account",
  feedback: "feedback",
  partner: "partner",
  "why-saatvik": "why",
  privacy: "info",
  terms: "info",
  shipping: "info",
  "rewards-policy": "info",
};

/** Longest path stored. */
export const maxTrackedPathLength = 191;

/**
 * The module of a page path ("/products/abc" → "shop"), or null when the
 * page isn't counted: admin pages, API calls, unknown addresses (404s and
 * probes) and sign-in links such as /reset-password or /admin-invite.
 */
export function sectionOf(path: string): PageSection | null {
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  const clean = path.split(/[?#]/)[0] ?? "";
  if (clean === "/" || clean === "") return "home";
  const first = clean.split("/")[1] ?? "";
  return Object.hasOwn(sectionByFirstSegment, first) ? sectionByFirstSegment[first]! : null;
}
