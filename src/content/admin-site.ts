// Admin copy for site settings and homepage content (P1.9). Keep user-facing
// text here so Hindi can be added later.

export const adminSettings = {
  metaTitle: "Settings",
  eyebrow: "Site",
  title: "Settings",
  description:
    "Phone number, footer text, announcement bar, delivery fee, the site-wide discount, seller details and the site switches. Every change is kept in the history.",
  saved: "Settings saved.",
  unchanged: "Nothing changed.",
  formError: "Please fix the highlighted fields.",
  save: "Save",
  historyTitle: "Recent changes",
  historyEmpty: "No changes yet.",
  historyBy: (name: string) => `by ${name}`,
  historySeed: "by the seed or a removed admin",
  groups: {
    contact: {
      title: "Contact and footer",
      phone: "Phone number",
      phoneHelp: 'Shown as "+91 92203 58400". The call link is made from it.',
      supportNote: "Support note",
      supportNoteHelp: 'The "Need assistance?" line in the footer.',
      footerTagline: "Footer tagline",
      footerTaglineHelp: "One line under the logo in the footer.",
      popularSearches: "Popular searches",
      popularSearchesHelp:
        "One per line, up to 8. Shown when someone opens the header search.",
    },
    announcement: {
      title: "Announcement bar",
      enabled: "Show the announcement bar",
      enabledHelp: "A slim bar above the header on every page.",
      text: "Announcement text",
      textHelp: "Up to 200 characters.",
      href: "Link target",
      hrefHelp:
        'Optional. A site path such as "/coins", or "modal:sign-in". Leave empty for plain text.',
    },
    shipping: {
      title: "Delivery fee",
      fee: "Delivery fee (₹)",
      feeHelp: "Added at checkout. Prices already include GST.",
      freeFrom: "Free delivery from (₹)",
      freeFromHelp: "Order value from which delivery is free. Leave empty for never.",
    },
    discount: {
      title: "Discount on all products",
      percent: "Discount (%)",
      percentHelp:
        "Taken off every price for everyone, including professional and bulk prices. Shown on the site as a percentage off with the old price struck through. Enter 0 to turn it off.",
    },
    seller: {
      title: "Seller details on invoices",
      legalName: "Legal name",
      addressLines: "Address",
      addressLinesHelp: "One to three lines.",
      city: "City",
      stateCode: "State",
      pincode: "PIN code",
      gstin: "GSTIN",
      gstinHelp:
        "15 characters. The first two digits must match the state's GST code.",
    },
    switches: {
      title: "Site switches",
      checkout: "Checkout",
      checkoutHelp:
        "Off: nobody can place a new order. Carts and existing orders still work.",
      coins: "Super Coins",
      coinsHelp: "Off: no earning or redeeming. The other coin rules are edited in Coins.",
      ebooks: "Ebook downloads",
      ebooksHelp: "Off: no ebook can be downloaded. Each book also has its own switch.",
      maintenance: "Maintenance mode",
      maintenanceHelp:
        "On: everyone except signed-in admins sees the maintenance page. Admins can still sign in.",
      maintenanceMessage: "Maintenance message",
      maintenanceMessageHelp: "Shown on the maintenance page.",
    },
  },
  errors: {
    phone: 'Use the format "+91 98765 43210".',
    text: "Fill this in (and keep it short).",
    list: "Add one to eight lines, each up to 60 characters.",
    link: 'Use a site path such as "/coins", or "modal:sign-in".',
    announcementText: "Add the text to show.",
    percent: "Enter a whole number from 0 to 90.",
    money: "Enter an amount in rupees, such as 80 or 99.50.",
    addressLines: "Add one to three lines, each up to 120 characters.",
    state: "Choose a state.",
    pincode: "Enter a 6-digit PIN code.",
    gstin: "Enter a valid GSTIN that starts with the state's GST code.",
  },
};

export const adminHome = {
  nav: { sections: "Sections", hero: "Hero slides", offers: "Offers", stats: "Trust stats", quickActions: "Quick actions", categories: "Categories", feedback: "Feedback", why: "Why Saatvik" },
  notFound: "That item could not be found.",
  keyTaken: "That key is already used. Choose another.",
  keyInvalid: "Use lowercase letters, numbers and dashes only.",
  formError: "Please fix the highlighted fields.",
  add: (label: string) => `Add ${label}`,
  newTitle: (label: string) => `New ${label}`,
  editTitle: (name: string) => `Edit ${name}`,
  columns: { title: "Title", key: "Key", status: "Status", sortOrder: "Order", actions: "Actions" },
  empty: "Nothing here yet.",
  jsonHelp: "JSON. Keep the same structure as the existing items.",
  jsonError: "This isn't valid for this slide type. Check the JSON.",
  sections: {
    metaTitle: "Homepage sections",
    eyebrow: "Homepage",
    title: "Sections",
    description:
      "Switch homepage sections on or off and set the order they appear in. Lower numbers show first.",
    columns: { section: "Section", shown: "Shown", order: "Order", heading: "Heading" },
    shown: "Shown",
    save: "Save sections",
    saved: "Sections saved.",
    edit: "Edit heading",
    editTitle: (name: string) => `Edit the ${name} heading`,
    errors: { order: "Enter a whole number." },
    labels: {
      hero: "Hero slides",
      trust: "Trust strip",
      reels: "Reels",
      offers: "Offers",
      "quick-actions": "Quick actions",
      launch: "Launch Your Brand",
      brands: "Brands",
      courses: "Courses and Saatvik Live",
      coins: "Super Coins",
      quiz: "Quiz & Win",
      feedback: "Feedback",
      community: "Community",
      partner: "Profile completion",
      why: "Why Saatvik",
    } as Record<string, string>,
    fields: {
      eyebrow: "Eyebrow",
      title: "Title",
      titleEmphasis: "Title, second line",
      titleEmphasisHelp: "Shown in teal under the title.",
      description: "Description",
      linkLabel: "Link label",
      linkHref: "Link target",
    },
  },
};

export type HomeKindKey =
  | "hero"
  | "offer"
  | "stat"
  | "quick-action"
  | "category"
  | "feedback"
  | "why";

export type HomeFieldType = "text" | "textarea" | "select" | "checkbox" | "number" | "json";

export type HomeField = {
  name: string;
  label: string;
  type: HomeFieldType;
  help?: string;
  optional?: boolean;
  max?: number;
  options?: readonly { value: string; label: string }[];
  wide?: boolean;
};

const tone = [
  { value: "ORANGE", label: "Orange" },
  { value: "TEAL", label: "Teal" },
  { value: "BLUE", label: "Blue" },
  { value: "GOLD", label: "Gold" },
  { value: "NAVY", label: "Navy" },
  { value: "GREEN", label: "Green" },
] as const;

const link = (name: string, label = "Link target"): HomeField => ({
  name,
  label,
  type: "text",
  optional: true,
  max: 200,
  help: 'A site path such as "/coins", or "modal:sign-in". Leave empty for "coming soon".',
});

const placement: HomeField[] = [
  { name: "sortOrder", label: "Sort order", type: "number", help: "Lower numbers show first." },
  { name: "active", label: "Show on the site", type: "checkbox" },
];

export type HomeKindSpec = {
  label: string;
  plural: string;
  path: string;
  /** The field shown as the row's name in lists. */
  titleField: string;
  fields: HomeField[];
};

export const homeKinds: Record<HomeKindKey, HomeKindSpec> = {
  hero: {
    label: "hero slide",
    plural: "Hero slides",
    path: "hero",
    titleField: "title",
    fields: [
      { name: "eyebrow", label: "Eyebrow", type: "text", max: 80 },
      { name: "title", label: "Title", type: "text", max: 160 },
      { name: "titleEmphasis", label: "Title, second line", type: "text", max: 160, optional: true },
      { name: "body", label: "Text", type: "textarea", max: 400, wide: true },
      { name: "primaryLabel", label: "Main button label", type: "text", max: 80 },
      link("primaryHref", "Main button target"),
      { name: "secondaryLabel", label: "Second button label", type: "text", max: 80, optional: true },
      link("secondaryHref", "Second button target"),
      {
        name: "panelKind",
        label: "Right-hand panel",
        type: "select",
        options: [
          { value: "LAUNCH_STUDIO", label: "Launch studio" },
          { value: "BRAND_SHOWCASE", label: "Brand showcase" },
          { value: "LEARNING_BOARD", label: "Learning board" },
        ],
      },
      { name: "panel", label: "Panel content", type: "json", wide: true, help: "JSON for the chosen panel type. Copy the structure of an existing slide." },
      { name: "proof", label: "Social-proof row", type: "json", optional: true, wide: true, help: 'Optional JSON: { "initials": ["DR"], "title": "…", "subtitle": "…" }.' },
      ...placement,
    ],
  },
  offer: {
    label: "offer",
    plural: "Offers",
    path: "offers",
    titleField: "title",
    fields: [
      { name: "tone", label: "Colour", type: "select", options: tone },
      { name: "iconText", label: "Icon text", type: "text", max: 8, help: "A short symbol or word, up to 8 characters." },
      { name: "eyebrow", label: "Eyebrow", type: "text", max: 80 },
      { name: "title", label: "Title", type: "text", max: 160 },
      { name: "body", label: "Text", type: "textarea", max: 300, wide: true },
      { name: "linkLabel", label: "Link label", type: "text", max: 80, help: "Also the arrow link's accessible name." },
      link("linkHref"),
      ...placement,
    ],
  },
  stat: {
    label: "trust stat",
    plural: "Trust stats",
    path: "stats",
    titleField: "label",
    fields: [
      { name: "value", label: "Figure", type: "text", max: 40, help: 'For example "150+".' },
      { name: "label", label: "Label", type: "text", max: 80 },
      ...placement,
    ],
  },
  "quick-action": {
    label: "quick action",
    plural: "Quick actions",
    path: "quick-actions",
    titleField: "title",
    fields: [
      { name: "tone", label: "Colour", type: "select", options: tone },
      { name: "iconText", label: "Icon text", type: "text", max: 8 },
      { name: "title", label: "Title", type: "text", max: 80 },
      { name: "description", label: "Description", type: "text", max: 160, wide: true },
      link("href"),
      ...placement,
    ],
  },
  category: {
    label: "category",
    plural: "Categories",
    path: "categories",
    titleField: "name",
    fields: [
      {
        name: "kind",
        label: "Type",
        type: "select",
        options: [
          { value: "FORM", label: "Product form" },
          { value: "PRACTICE_AREA", label: "Practice area" },
        ],
      },
      { name: "name", label: "Name", type: "text", max: 80 },
      { name: "glyph", label: "Devanagari mark", type: "text", max: 8, optional: true, help: 'A short mark shown on the tile, such as "चू".' },
      ...placement,
    ],
  },
  feedback: {
    label: "feedback",
    plural: "Feedback",
    path: "feedback",
    titleField: "caption",
    fields: [
      { name: "imageSrc", label: "Image path", type: "text", max: 200, help: 'A path under public/, such as "/media/feedback-1.jpg".' },
      { name: "imageAlt", label: "Image description", type: "text", max: 200 },
      { name: "badge", label: "Badge", type: "text", max: 60 },
      { name: "quote", label: "Quote", type: "textarea", max: 600, wide: true },
      { name: "caption", label: "Caption", type: "text", max: 160 },
      { name: "linkLabel", label: "Link label", type: "text", max: 80 },
      link("linkHref"),
      { name: "featured", label: "Show large (featured)", type: "checkbox" },
      ...placement,
    ],
  },
  why: {
    label: "step",
    plural: "Why Saatvik steps",
    path: "why",
    titleField: "title",
    fields: [
      { name: "title", label: "Title", type: "text", max: 80 },
      { name: "body", label: "Text", type: "textarea", max: 300, wide: true },
      ...placement,
    ],
  },
};

export const homeKindByPath = Object.fromEntries(
  (Object.entries(homeKinds) as [HomeKindKey, HomeKindSpec][]).map(([kind, spec]) => [spec.path, kind]),
) as Record<string, HomeKindKey>;
