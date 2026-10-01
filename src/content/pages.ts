// Strings for the ComingSoon routes (/coins) and the policy placeholder pages. Keep
// user-facing text here so Hindi can be added later.

export type ComingSoonPageCopy = {
  metaTitle: string;
  title: string;
  line: string;
};

export const comingSoonPages = {
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
