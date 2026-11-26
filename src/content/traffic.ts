// Traffic (/admin/traffic): page views on the public site. Keep user-facing
// text here so Hindi can be added later.

import type { PageSection } from "@/lib/page-sections";

export const traffic = {
  nav: "Traffic",
  keywords: "analytics visitors page views visits modules popular pages",
  metaTitle: "Traffic",
  eyebrow: "Overview",
  title: "Traffic",
  description:
    "Which parts of the site people open, and who opens them. Admins and search-engine bots aren't counted, and no cookies are used.",
  filterLabel: "Choose a period",
  from: "From",
  to: "To",
  by: "Show by",
  groupings: { day: "Day", week: "Week", month: "Month" },
  apply: "Show",
  reset: "Last 30 days",
  range: (from: string, to: string) => `From ${from} to ${to}, India time.`,

  figures: {
    views: "Page views",
    viewsHelp: "Every page opened.",
    visitors: "Visitors",
    visitorsHelp: "Different people each day, added up.",
    perVisitor: "Pages per visitor",
    signedIn: "By signed-in members",
    signedInHelp: (share: string) => `${share} of page views.`,
  },
  columns: { views: "Views", visitors: "Visitors", share: "Share" },

  trend: {
    title: "Over time",
    period: { day: "Day", week: "Week from", month: "Month" },
  },
  sections: {
    title: "Modules",
    note: "Each part of the site, most visited first.",
    module: "Module",
  },
  pages: {
    title: "Most viewed pages",
    note: "The 25 pages opened most. Numbers in addresses (order and quiz ids) are shown as :id.",
    page: "Page",
  },
  audiences: {
    title: "Who visits",
    note: "By account type. Visitors who aren't signed in are guests.",
    type: "Account type",
    guest: "Guests (not signed in)",
    unknown: "Account type removed",
  },
  devices: {
    title: "Devices",
    device: "Device",
    names: {
      mobile: "Phone",
      tablet: "Tablet",
      desktop: "Computer",
      unknown: "Unknown",
    } as Record<string, string>,
  },
  empty: "No page views in this period yet.",
  privacyNote:
    "How it's counted: the browser reports each page after it has loaded. A visitor is recognised for one day only, from a scrambled code that can't be traced back to a person; no account is linked to a view. Detailed rows are kept 90 days, then only daily totals.",

  sectionNames: {
    home: "Home page",
    shop: "Top Brands (shop)",
    cart: "Cart and checkout",
    brand: "Build Your Brand",
    courses: "Courses",
    doctorTalk: "Dr. Talk",
    quiz: "Quiz & Win",
    coins: "Saatvik Coins",
    ebooks: "Ebooks",
    orders: "Orders and tracking",
    account: "My account",
    feedback: "Real Feedback",
    partner: "Partner & Grow",
    why: "Why Saatvik",
    info: "Policies",
  } satisfies Record<PageSection, string>,
} as const;
