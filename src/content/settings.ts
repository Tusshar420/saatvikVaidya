// Defaults for settings the admin will edit later. getSetting()
// (src/server/content/settings.ts) falls back to these; A4 seeds them into the
// Setting table.

export type SettingValues = {
  /** Shown as "+91 92203 58400"; the tel: link is derived from it. */
  "contact.phone": string;
  /** The "Need assistance?" note in the footer. */
  "contact.supportNote": string;
  /** Suggestions in the header search popover. */
  "search.popular": readonly string[];
  /** One line under the logo in the footer. */
  "footer.tagline": string;
  /**
   * Delivery charge added at checkout, in paise (prices include GST), and
   * the order value from which delivery is free (null: never free).
   */
  "checkout.shipping": { feePaise: number; freeFromPaise: number | null };
  /**
   * The seller printed on GST invoices and credit notes (P1.6). `stateCode`
   * is the ISO code from src/lib/india.ts; it decides CGST + SGST (same
   * state as the delivery address) or IGST. The GSTIN's first two digits
   * must be that state's GST code.
   */
  "invoice.seller": {
    legalName: string;
    addressLines: readonly string[];
    city: string;
    stateCode: string;
    pincode: string;
    gstin: string;
  };
  /**
   * Super Coins rules (P1.7). Editable in /admin/coins.
   * - `earnPerThousandRupees`: coins earned per ₹1,000 of items (after
   *   coins used, without delivery).
   * - `earnAfterDelivery`: earn when delivered; otherwise when paid.
   * - `interestsReward` / `detailsReward`: profile-completion rewards.
   * - `quizReward`: coins for a qualifying Quiz & Win score (P2.3), once
   *   per attempt. The pass mark is set on each quiz.
   * - `coinsPerRupee`: how many coins are worth ₹1.
   * - `maxRedeemPercent` / `maxRedeemCoins`: most of an order's items total
   *   (and most coins) that can be paid with coins.
   * - `expiryMonths`: how long earned coins last; 0 never expires.
   */
  "coins.rules": {
    enabled: boolean;
    earnPerThousandRupees: number;
    earnAfterDelivery: boolean;
    interestsReward: number;
    detailsReward: number;
    quizReward: number;
    coinsPerRupee: number;
    maxRedeemPercent: number;
    maxRedeemCoins: number;
    expiryMonths: number;
  };
  /**
   * The site-wide ebook download switch (P1.8). Each book has its own switch
   * too; either off pauses that book's downloads.
   */
  "ebooks.downloads": { enabled: boolean };
  /**
   * The slim bar above the header (P1.9). `href` is a site path or modal
   * target (src/server/content/home-schema.ts), or null for plain text.
   */
  "site.announcement": { enabled: boolean; text: string; href: string | null };
  /**
   * Site-wide discount taken off every price (retail, professional and bulk).
   * Whole percent, 0 to 90; 0 turns it off. Editable in /admin/settings.
   */
  "pricing.discount": { percent: number };
  /**
   * Where customers pay when PAYMENT_PROVIDER=manual: they place the order,
   * then pay by UPI QR code or bank transfer, and an admin marks it paid.
   * `upiId` makes the QR code (amount and order number filled in); empty
   * fields are left out of the payment screen.
   */
  "payment.manual": {
    payeeName: string;
    upiId: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    note: string;
  };
  /** Checkout switch (P1.9): off stops new orders; carts still work. */
  "checkout.enabled": { enabled: boolean };
  /**
   * Maintenance mode (P1.9): visitors see a branded page; signed-in admins
   * see the site as usual.
   */
  "site.maintenance": { enabled: boolean; message: string };
};

export type SettingKey = keyof SettingValues;

export const settingDefaults: SettingValues = {
  "contact.phone": "+91 92203 58400",
  "contact.supportNote":
    "Our support team will call you within 24–48 working hours after an order request.",
  "search.popular": [
    "Punarnava Mandoor",
    "Kidney Care Course",
    "Build Your Brand",
  ],
  "footer.tagline":
    "A B2B Ayurveda platform for products, professional learning and practice growth.",
  // Placeholder amounts until the client confirms them (₹80, free from ₹999).
  "checkout.shipping": { feePaise: 8_000, freeFromPaise: 99_900 },
  // Placeholders until the client sends the firm's registered details
  // (P1.9 makes them editable in /admin/settings).
  "invoice.seller": {
    legalName: "Saatvik Vaidya (placeholder legal name)",
    addressLines: ["Registered address to be confirmed"],
    city: "Mumbai",
    stateCode: "MH",
    pincode: "400001",
    gstin: "27AAAAA0000A1Z5",
  },
  // From the mockup: 1,000 coins on a ₹10,000 order, 10 coins = ₹1, valid 60
  // months, 250 + 750 for completing the profile. The redeem caps are
  // placeholders until the client confirms them.
  "coins.rules": {
    enabled: true,
    earnPerThousandRupees: 100,
    earnAfterDelivery: true,
    interestsReward: 250,
    detailsReward: 750,
    quizReward: 100,
    coinsPerRupee: 10,
    maxRedeemPercent: 20,
    maxRedeemCoins: 5_000,
    expiryMonths: 60,
  },
  "ebooks.downloads": { enabled: true },
  "site.announcement": { enabled: false, text: "", href: null },
  "pricing.discount": { percent: 20 },
  // Placeholders until the client sends the firm's UPI and bank details.
  "payment.manual": {
    payeeName: "Saatvik Vaidya",
    upiId: "",
    bankName: "",
    accountNumber: "",
    ifsc: "",
    note: "",
  },
  "checkout.enabled": { enabled: true },
  "site.maintenance": {
    enabled: false,
    message:
      "We're making the site better and will be back shortly. Thank you for your patience.",
  },
};
