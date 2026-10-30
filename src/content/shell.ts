// Strings for the site shell: header, nav rail, footer, mobile dock and the
// modals they open. Keep user-facing text here so Hindi can be added later.

/** Homepage sections the nav rail and footer link to, by section id. */
export const homeSections = {
  launch: "Build Your Brand",
  brands: "Top Brands",
  courses: "Courses",
  coins: "Saatvik Coins",
  quiz: "Quiz & Win",
  feedback: "Verified Feedback",
  partner: "Partner & Grow",
  why: "Why Saatvik",
} as const;

export type HomeSectionId = keyof typeof homeSections;

export type NavItem = {
  id: HomeSectionId;
  label: string;
  /** Shows a "Soon" tag (Partner & Grow is undecided, see docs/PLAN.md). */
  soon?: boolean;
};

/** Nav rail order, as in the mockup. A8 filters it by enabled sections. */
export const navItems: readonly NavItem[] = (
  Object.keys(homeSections) as HomeSectionId[]
).map((id) => ({ id, label: homeSections[id], soon: id === "partner" }));

/** Where a v2 nav pill sits: plain, or the solid green / orange priority pills. */
/** Screen-reader text for a nav link's new-notification badge. */
export const navBadgeLabel = (count: number) => `${count} new`;

export type SiteNavTone = "plain" | "brand" | "orange";

export type SiteNavLink = {
  href: string;
  label: string;
  tone?: SiteNavTone;
};

/**
 * The v2 nav rail (U.4), in the client's order. Every link is a real page;
 * Home is added by the rail itself.
 */
export const siteNav: readonly SiteNavLink[] = [
  { href: "/doctor-talk", label: "Dr. Talk", tone: "brand" },
  { href: "/quiz", label: "Quiz & Win" },
  { href: "/launch", label: "Build Your Brand" },
  { href: "/products", label: "Top Brands" },
  { href: "/courses", label: "Courses" },
  { href: "/coins", label: "Saatvik Coins" },
  { href: "/track", label: "Track Order" },
  { href: "/feedback", label: "Real Feedback" },
  { href: "/partner", label: "Partner & Grow" },
  { href: "/why-saatvik", label: "Why Saatvik" },
];

/** Footer link columns (U.4). `modal:` entries open a site modal. */
export const footerColumns = [
  {
    title: "Explore",
    links: [
      { href: "/doctor-talk", label: "Dr. Talk" },
      { href: "/quiz", label: "Quiz & Win" },
      { href: "/courses", label: "Courses" },
      { href: "/feedback", label: "Saatvik Reels" },
    ],
  },
  {
    title: "Products",
    links: [
      { href: "/launch", label: "Build Your Brand" },
      { href: "/products", label: "Top Brands" },
      { href: "modal:track-order", label: "Track Order" },
      { href: "/coins", label: "Saatvik Coins" },
      { href: "/ebooks", label: "Ebooks" },
    ],
  },
] as const;

export const policyLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/shipping", label: "Shipping" },
  { href: "/rewards-policy", label: "Rewards Policy" },
] as const;

export type PolicyHref = (typeof policyLinks)[number]["href"];

export const shell = {
  skipLink: "Skip to content",
  brand: {
    homeLabel: "Saatvik Vaidya home",
    first: "Saatvik",
    second: "Vaidya",
    mark: "SV",
    tagline: "हमारा आयुर्वेद, हमारा गर्व",
  },
  search: {
    label: "Search the website",
    placeholder: "Search products, brands, courses…",
    shortcutHint: "⌘ K",
    openSearch: "Search",
    popularTitle: "Popular searches",
  },
  header: {
    trackOrder: "Track Order",
    bag: (count: number) => `Bag, ${count} ${count === 1 ? "item" : "items"}`,
    profileTitle: "My Profile",
    profileSubtitle: "Sign in / Register",
    callUs: "Call us",
    logoAlt: "Saatvik Vaidya — हमारा आयुर्वेद, हमारा गर्व",
  },
  /** The orange bar above the header, built from the coin rules (U.4). */
  announcement: {
    earn: (orderRupees: string, coins: string) =>
      `₹${orderRupees} order = ${coins} Saatvik Coins`,
    rate: (coinsPerRupee: string) => `${coinsPerRupee} Coins = ₹1`,
    validity: (months: number) => `Valid for ${months} months`,
    cta: "View Coins",
  },
  nav: {
    label: "Sections",
    home: "Home",
    soon: "Soon",
  },
  footer: {
    platformTitle: "Platform",
    platformLinks: ["launch", "brands", "courses", "coins"],
    ebooks: "Ebooks",
    supportTitle: "Support",
    trackOrder: "Track Order",
    reportProblem: "Report a problem",
    supportLinks: ["feedback", "partner", "why"],
    assistanceTitle: "Need assistance?",
    call: (phone: string) => `Call ${phone}`,
    copyright: (year: number) => `© ${year} Saatvik Vaidya`,
    rights: "All rights reserved.",
    builtFor: "Built for Ayurveda professionals",
    hindiLine: "हमारा आयुर्वेद, हमारा गर्व",
    policiesLabel: "Policies",
    partner: "Partner & Grow",
    why: "Why Saatvik",
  },
  sticky: {
    label: "Quick contact",
    feedback: "Feedback",
    whatsapp: "WhatsApp",
    whatsappHint: "Chat with us on WhatsApp",
  },
  dock: {
    label: "Quick navigation",
    coins: "Coins",
    updates: "Updates",
    courses: "Courses",
    orders: "Order",
    you: "You",
    /** The same links in the nav rail on bigger screens, where there's room. */
    railOrders: "My Orders",
    railYou: "My Account",
  },
  trackOrder: {
    eyebrow: "Track order",
    title: "Know exactly what happens next.",
    description:
      "Enter your order number and the mobile number or email used for the order.",
    myOrdersLead: "Signed in? See every order in",
    myOrders: "My orders",
    helpLead: "Need an update now?",
    call: (phone: string) => `Call ${phone}`,
    close: "Close",
  },
} as const;

/**
 * The phone dock's links. Under 560 px the dock shows them at the bottom of
 * the screen; from 560 px up there is no dock, so the nav rail shows them
 * after the main links instead (the client asked for every link to stay
 * reachable on big screens without repeating them on phones).
 */
export const dockNav = [
  { href: "/coins", label: shell.dock.coins, railLabel: shell.dock.coins },
  { href: "/notifications", label: shell.dock.updates, railLabel: shell.dock.updates },
  { href: "/courses", label: shell.dock.courses, railLabel: shell.dock.courses },
  { href: "/orders", label: shell.dock.orders, railLabel: shell.dock.railOrders },
  { href: "/account", label: shell.dock.you, railLabel: shell.dock.railYou },
] as const;

export type DockHref = (typeof dockNav)[number]["href"];
