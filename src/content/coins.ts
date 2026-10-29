// Strings for Saatvik Coins: /coins, the checkout option and the order lines.
// Keep user-facing text here so Hindi can be added later.

import type { CoinReason } from "@/generated/prisma/client";

const count = (n: number) => n.toLocaleString("en-IN");

export const coins = {
  metaTitle: "Saatvik Coins",
  eyebrow: "Saatvik Coins",
  title: "Growth should feel rewarding.",
  hero: {
    description:
      "Earn Saatvik Coins through eligible orders, learning activities and verified profile completion. Use them on upcoming orders.",
    status: "Built for professionals",
    noteTitle: "Simple and transparent",
    noteText: (coinsPerRupee: number, months: number) =>
      `${count(coinsPerRupee)} Coins = ₹1 · ${months > 0 ? `Coins remain valid for ${count(months)} months from the date they are earned.` : "Coins never expire."}`,
  },
  wallet: {
    eyebrow: "Your Saatvik wallet",
    signedOutTitle: "Sign in to view balance",
    signedInLine: "Your available, used and expiring Coins in one place.",
    formulaOrder: "Eligible order",
    formulaCoins: (n: number) => `${count(n)} Coins`,
    formulaWorth: (rupees: string) => `Worth ${rupees}`,
    signIn: "Continue with Mobile OTP",
  },
  rules: {
    earnIcon: "+S",
    useIcon: "₹",
    validityTitle: "Validity",
    validity: (months: number) =>
      months > 0 ? `Each Coin entry remains valid for ${count(months)} months from its earning date.` : "Coins never expire.",
    historyIcon: "↺",
    historyTitle: "Clear history",
    historyText: "See earned, used, returned and expired entries after signing in.",
    historyTextSignedIn: "Every entry you earn, use, get back or lose to expiry is listed below.",
  },
  signedOutLine: "Sign in to see your coins, earn them on orders and use them at checkout.",
  signIn: "Sign in",
  paused: "Saatvik Coins are paused right now. Your balance is safe and will be here when they return.",

  balance: {
    label: "Your balance",
    coins: (n: number) => `${count(n)} coins`,
    worth: (rupees: string) => `Worth ${rupees}`,
    expiry: (n: number, date: string) => `${count(n)} coins expire on ${date}`,
  },

  earn: {
    title: "How to earn",
    order: (per: number, rupees: string, afterDelivery: boolean) =>
      `${count(per)} coins for every ${rupees} of products${afterDelivery ? ", added once your order is delivered" : ", added when your order is paid"}.`,
    interests: (n: number) => `${count(n)} coins for adding your practice interests.`,
    quiz: (n: number) => `${count(n)} coins for a qualifying score in the weekly Quiz & Win.`,
    details: (n: number) => `${count(n)} coins once your professional details are approved.`,
    /** Short form for the rule card: "Also 100 for the weekly quiz, 250 for practice interests." */
    extras: (quiz: number, interests: number, details: number) => {
      const parts = [
        quiz > 0 ? `${count(quiz)} for the weekly quiz` : null,
        interests > 0 ? `${count(interests)} for practice interests` : null,
        details > 0 ? `${count(details)} for approved professional details` : null,
      ].filter(Boolean);
      return parts.length ? `Also ${parts.join(", ")}.` : null;
    },
    expiry: (months: number) =>
      months > 0 ? `Coins are valid for ${count(months)} months.` : "Coins never expire.",
  },

  use: {
    title: "How to use",
    line: (coinsPerRupee: number, percent: number) =>
      `${count(coinsPerRupee)} coins = ₹1. At checkout, coins can pay up to ${count(percent)}% of the products total.`,
    shop: "Shop products",
  },

  history: {
    title: "Coin history",
    signInRequired: "Sign in required",
    entries: (n: number) => `${count(n)} ${n === 1 ? "entry" : "entries"}`,
    kinds: [
      { title: "Eligible order reward", text: "Visible after order delivery", amount: "+ Coins", note: "Order reward" },
      { title: "Quiz & Win reward", text: "Once per qualifying weekly quiz", amount: "+ Coins", note: "Activity reward" },
      { title: "Coins used on order", text: "Shown with order reference", amount: "− Coins", note: "Order benefit" },
    ],
    noExpiry: "No expiry",
    empty: "No coin activity yet. Your first order will show here.",
    columns: { when: "Date", what: "What", coins: "Coins" },
    expiresOn: (date: string) => `Expires ${date}`,
    reason: {
      earn_order: (number: string | null) => (number ? `Earned on order ${number}` : "Earned on an order"),
      earn_reversal: (number: string | null) =>
        number ? `Taken back: order ${number} was cancelled` : "Taken back: order cancelled",
      earn_profile: (kind: string | null) =>
        kind === "interests" ? "Profile reward: practice interests" : "Profile reward: professional details",
      redeem: (number: string | null) => (number ? `Used on order ${number}` : "Used on an order"),
      redeem_return: (number: string | null) =>
        number ? `Returned: order ${number}` : "Returned from an order",
      earn_quiz: () => "Quiz & Win reward",
      admin_adjust: (note: string | null) => (note ? `Adjustment: ${note}` : "Adjustment by Saatvik Vaidya"),
    } satisfies Record<CoinReason, (detail: string | null) => string>,
    pageOf: (page: number, pages: number) => `Page ${count(page)} of ${count(pages)}`,
    prev: "Newer",
    next: "Older",
  },

  checkout: {
    title: "Saatvik Coins",
    label: (coinsUsed: number, rupees: string) => `Use ${count(coinsUsed)} coins (save ${rupees})`,
    help: (balance: number) => `You have ${count(balance)} coins. Some stay in your balance if the limit is lower.`,
    none: (balance: number) => `You have ${count(balance)} coins, but this order can't use them.`,
    saved: (rupees: string) => `Saatvik Coins (${rupees} off)`,
  },

  order: {
    row: "Saatvik Coins used",
    used: (n: number) => `${count(n)} coins`,
  },
} as const;
