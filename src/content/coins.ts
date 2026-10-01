// Strings for Super Coins: /coins, the checkout option and the order lines.
// Keep user-facing text here so Hindi can be added later.

import type { CoinReason } from "@/generated/prisma/client";

const count = (n: number) => n.toLocaleString("en-IN");

export const coins = {
  metaTitle: "Super Coins",
  eyebrow: "Saatvik Coins",
  title: "Growth should feel rewarding.",
  signedOutLine: "Sign in to see your coins, earn them on orders and use them at checkout.",
  signIn: "Sign in",
  paused: "Super Coins are paused right now. Your balance is safe and will be here when they return.",

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
    details: (n: number) => `${count(n)} coins once your professional details are approved.`,
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
    title: "History",
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
      admin_adjust: (note: string | null) => (note ? `Adjustment: ${note}` : "Adjustment by Saatvik Vaidya"),
    } satisfies Record<CoinReason, (detail: string | null) => string>,
    pageOf: (page: number, pages: number) => `Page ${count(page)} of ${count(pages)}`,
    prev: "Newer",
    next: "Older",
  },

  checkout: {
    title: "Super Coins",
    label: (coinsUsed: number, rupees: string) => `Use ${count(coinsUsed)} coins (save ${rupees})`,
    help: (balance: number) => `You have ${count(balance)} coins. Some stay in your balance if the limit is lower.`,
    none: (balance: number) => `You have ${count(balance)} coins, but this order can't use them.`,
    saved: (rupees: string) => `Super Coins (${rupees} off)`,
  },

  order: {
    row: "Super Coins used",
    used: (n: number) => `${count(n)} coins`,
  },
} as const;
