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
};

export type SettingKey = keyof SettingValues;

export const settingDefaults: SettingValues = {
  "contact.phone": "+91 92203 58400",
  "contact.supportNote":
    "Our support team will call you within 24–48 working hours after an order request.",
  "search.popular": [
    "Punarnava Mandoor",
    "Kidney Care Course",
    "Launch Your Brand",
  ],
  "footer.tagline":
    "A B2B Ayurveda platform for products, professional learning and practice growth.",
  // Placeholder amounts until the client confirms them (₹80, free from ₹999).
  "checkout.shipping": { feePaise: 8_000, freeFromPaise: 99_900 },
};
