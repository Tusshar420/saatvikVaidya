// Strings for ebooks (P1.8): /ebooks, /ebooks/[slug], "My ebooks" on
// /account and the ebook card on an order. Keep user-facing text here so
// Hindi can be added later.

export const ebooks = {
  metaTitle: "Ebooks",
  metaDescription: "Free and paid Ayurveda ebooks from Saatvik Vaidya.",
  eyebrow: "Ebooks",
  title: "Read, learn, practise.",
  titleEmphasis: "Ayurveda ebooks.",
  intro:
    "Free ebooks download once you sign in. Paid ones are bought through the cart and then download from here and your account.",
  listLabel: "Ebooks",
  empty: {
    title: "No ebooks yet",
    line: "New ebooks are on the way. Browse the catalogue meanwhile.",
    action: "Browse products",
  },
  pausedSite: "Ebook downloads are paused right now. Your ebooks are safe and will be ready again soon.",

  free: "Free",
  price: (price: string) => price,
  priceNote: "Price includes GST.",
  by: (author: string) => `by ${author}`,
  pdf: (size: string) => `PDF, ${size}`,
  owned: "Yours",
  view: (title: string) => `View ${title}`,
  back: "All ebooks",

  actions: {
    download: "Download PDF",
    downloadLabel: (title: string) => `Download ${title} (PDF)`,
    signIn: "Sign in to download",
    addToCart: "Add to cart",
    adding: "Adding…",
    inCart: "In your cart",
    viewCart: "View cart",
    paused: "Downloads are paused",
    pausedLine: "Downloads of this ebook are paused right now. Please check back soon.",
    unavailable: "Not available",
    awaitingTitle: "Waiting for your payment",
    awaitingText: "You've ordered this ebook. You can download it as soon as our team confirms your payment.",
    awaitingPay: "See how to pay",
  },

  account: {
    title: "My ebooks",
    empty: "Ebooks you buy show here, ready to download.",
    browse: "Browse ebooks",
  },

  order: {
    title: "Your ebooks",
    ready: "Ready to download from here or your account.",
    unpaid: "Your ebooks are ready to download once this order is paid.",
    cancelled: "This order was cancelled, so its ebooks can't be downloaded.",
  },
} as const;
