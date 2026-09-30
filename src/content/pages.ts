// Strings for the ComingSoon routes and the policy placeholder pages. Keep
// user-facing text here so Hindi can be added later.

export type ComingSoonPageCopy = {
  metaTitle: string;
  title: string;
  line: string;
};

export const comingSoonPages = {
  search: {
    metaTitle: "Search",
    title: "Search is coming soon",
    line: "We're adding our full range of medicines, brands and courses. Until then, call us and we'll help you find what you need.",
    query: (q: string) => `We'll look for “${q}” as soon as search opens.`,
  },
  cart: {
    metaTitle: "Cart",
    title: "Your cart is coming soon",
    line: "Online ordering opens soon. To place an order today, call us and our team will take it from there.",
  },
  orders: {
    metaTitle: "Orders",
    title: "Your orders will show here",
    line: "Once online ordering opens, you'll see every order and follow its progress on this page.",
  },
  coins: {
    metaTitle: "Saatvik Coins",
    title: "Saatvik Coins are coming soon",
    line: "Soon you'll earn coins on every order and redeem them on the next one. Your balance will show here.",
  },
  backHome: "Back to home",
  call: (phone: string) => `Call ${phone}`,
} as const;

export type PolicyPageCopy = { metaTitle: string; title: string };

export const policyPages = {
  privacy: { metaTitle: "Privacy policy", title: "Privacy policy" },
  terms: { metaTitle: "Terms of use", title: "Terms of use" },
  shipping: { metaTitle: "Shipping policy", title: "Shipping policy" },
  rewards: { metaTitle: "Rewards policy", title: "Rewards policy" },
  eyebrow: "Policies",
  status: "Being prepared",
  body: "We're finalising this policy and will publish it here before online ordering opens.",
  contactLead: "Questions in the meantime?",
  call: (phone: string) => `Call ${phone}`,
  otherPolicies: "Other policies",
  backHome: "Back to home",
} as const;
