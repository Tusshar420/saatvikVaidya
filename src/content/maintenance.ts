// Maintenance page, announcement bar and the checkout-off notice (P1.9).
// Keep user-facing text here so Hindi can be added later.

export const maintenance = {
  metaTitle: "Back soon",
  eyebrow: "Maintenance",
  title: "We'll be back",
  titleEmphasis: "very soon.",
  callLine: "Need us urgently? Call",
  adminSignIn: "Admin sign-in",
} as const;

// The same page on the live site before launch (SITE_COMING_SOON=true).
export const comingSoon = {
  eyebrow: "Coming soon",
  title: "Saatvik Vaidya is",
  titleEmphasis: "opening soon.",
  message:
    "Our Ayurveda store, courses and doctors' community open shortly. Until then, call us for anything you need.",
} as const;

export const announcement = {
  label: "Announcement",
} as const;

export const checkoutOff = {
  title: "Checkout is paused",
  body: "We're not taking new orders for a short while. Your cart is saved, so please come back soon.",
  backToCart: "Back to cart",
} as const;
