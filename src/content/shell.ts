// Strings for the site shell: header, nav rail, footer, mobile dock and the
// modals they open. Keep user-facing text here so Hindi can be added later.

/** Homepage sections the nav rail and footer link to, by section id. */
export const homeSections = {
  launch: "Launch Your Brand",
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
    supportLinks: ["feedback", "partner", "why"],
    assistanceTitle: "Need assistance?",
    call: (phone: string) => `Call ${phone}`,
    copyright: (year: number) => `© ${year} Saatvik Vaidya`,
    policiesLabel: "Policies",
  },
  dock: {
    label: "Quick navigation",
    home: "Home",
    myBrand: "My Brand",
    orders: "Orders",
    coins: "Coins",
    profile: "Profile",
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
