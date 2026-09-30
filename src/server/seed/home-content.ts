import type { Prisma } from "@/generated/prisma/client";
import type { HomeSectionKey } from "@/server/content/home-schema";

// Homepage content, copied from docs/mockup/index.html. Arrows (→) and ticks
// (✓) that the mockup uses as decoration are left out; components draw them.
// A null href means the destination isn't built yet ("coming soon").
// Media files are copies of docs/mockup/assets in public/media/.

type Seed<T> = Omit<T, "createdAt" | "updatedAt">;

export type HomeSectionSeed = Seed<
  Omit<Prisma.HomeSectionCreateInput, "content">
> & {
  key: HomeSectionKey;
  /** Validated against sectionContentSchemas by the seed. */
  content?: Prisma.InputJsonObject;
};

export const homeSectionSeed: HomeSectionSeed[] = [
  { key: "hero", sortOrder: 10 },
  { key: "trust", sortOrder: 20 },
  {
    key: "reels",
    sortOrder: 30,
    eyebrow: "WATCH & EXPLORE",
    title: "Saatvik Reels",
    description:
      "Products, practitioner experiences, courses and opportunities—in under 60 seconds.",
    linkLabel: "View all reels",
    linkHref: null,
    content: {
      filters: {
        all: "All",
        PRODUCT: "Products",
        FEEDBACK: "Doctor Feedback",
        LEARNING: "Courses",
        OFFER: "Offers",
      },
    },
  },
  {
    key: "offers",
    sortOrder: 40,
    eyebrow: "CURRENT OPPORTUNITIES",
    title: "Offers worth acting on",
    linkLabel: "View all offers",
    linkHref: "/#coins",
  },
  {
    key: "quick-actions",
    sortOrder: 50,
    eyebrow: "START HERE",
    title: "What would you like to do?",
  },
  {
    key: "launch",
    sortOrder: 60,
    eyebrow: "LAUNCH YOUR BRAND",
    title: "From clinical insight",
    titleEmphasis: "to a market-ready identity.",
    description:
      "Select a formulation, explore label directions and submit one complete request. Our team reviews the technical details before confirmation.",
    linkLabel: "Explore 150+ formulations",
    linkHref: "/#launch-catalogue",
    content: {
      steps: [
        {
          title: "Choose your formulation",
          body: "Browse by category or practice area",
        },
        {
          title: "Choose your identity",
          body: "Add brand logo, MRP and Marketed By details",
        },
        {
          title: "Review before production",
          body: "Approve quotation and final label proof",
        },
      ],
      catalogue: {
        eyebrow: "PRODUCT CATALOGUE",
        title: "Find the right starting point",
        filtersLabel: "Filters",
        searchPlaceholder: "Search 150+ formulations",
        formTab: "By Form",
        practiceAreaTab: "By Practice Area",
        categoryLinkLabel: "Explore products",
      },
    },
  },
  {
    key: "brands",
    sortOrder: 70,
    eyebrow: "TOP BRANDS",
    title: "Selected ranges for professional buying",
    description:
      "Browse by brand, product form or practice need—and build one flexible order request.",
    linkLabel: "Explore all brands",
    linkHref: null,
  },
  {
    key: "courses",
    sortOrder: 80,
    eyebrow: "COURSES & SAATVIK LIVE",
    title: "Clinical learning,",
    titleEmphasis: "designed for application.",
    description:
      "Focused programs, live discussions and practical resources created exclusively for Ayurveda professionals.",
    linkLabel: "Explore all courses",
    linkHref: null,
  },
  {
    key: "coins",
    sortOrder: 90,
    eyebrow: "SAATVIK COINS",
    title: "Growth should feel rewarding.",
    description:
      "Earn 1,000 Saatvik Coins on an eligible ₹10,000 order. Redeem them on upcoming orders within 60 months.",
    linkLabel: "View my rewards",
    linkHref: "/coins",
    content: {
      equation: {
        coins: "10 Coins",
        value: "₹1",
        note: "1,000 Coins are worth ₹100",
      },
    },
  },
  {
    key: "quiz",
    sortOrder: 100,
    eyebrow: "QUIZ & WIN",
    title: "How strong is your Ayurveda knowledge?",
    description: "10 questions • 5 minutes • Coins for qualifying scores",
    linkLabel: "Start this week’s quiz",
    linkHref: null,
    content: {
      badge: "Weekly Challenge",
      question: {
        label: "Question 1",
        text: "Which concept primarily guides individualised Ahara selection?",
        timer: "05:00",
      },
      note: "🏆 Weekly & monthly leaderboards",
    },
  },
  {
    key: "feedback",
    sortOrder: 110,
    eyebrow: "VERIFIED FEEDBACK",
    title: "Real experiences. Original words.",
    description:
      "Feedback shared by Ayurveda professionals through videos, photographs and original letterheads.",
    linkLabel: "View all feedback",
    linkHref: null,
  },
  {
    key: "community",
    sortOrder: 120,
    eyebrow: "COMING IN PHASE 2",
    title: "Vaidya Community",
    description:
      "A verified space for clinical discussions, classical references and professional growth.",
    linkLabel: "Join early access",
    linkHref: "modal:sign-in",
    content: {
      points: [
        "De-identified case discussions",
        "Ask experts and peers",
        "Quality-led contributor recognition",
      ],
    },
  },
  {
    key: "partner",
    sortOrder: 130,
    eyebrow: "PERSONALISED FOR YOUR PRACTICE",
    title: "Complete your professional profile.",
    titleEmphasis: "Earn 1,000 Saatvik Coins.",
    description:
      "Select your practice interests to discover more relevant products, courses and offers.",
    linkLabel: "Create My Profile",
    linkHref: "modal:sign-in",
    content: {
      completion: {
        label: "PROFILE COMPLETION",
        rewardLabel: "+1,000 Coins",
        examplePercent: 40,
        steps: [
          {
            key: "mobileVerified",
            label: "Mobile verified",
            coins: 0,
            exampleDone: true,
          },
          {
            key: "userTypeSelected",
            label: "User type selected",
            coins: 0,
            exampleDone: true,
          },
          {
            key: "practiceInterests",
            label: "Add practice interests",
            coins: 250,
            exampleDone: false,
          },
          {
            key: "professionalDetails",
            label: "Add professional details",
            coins: 750,
            exampleDone: false,
          },
        ],
        note: "Coins activate after professional verification or your first valid order.",
      },
    },
  },
  {
    key: "why",
    sortOrder: 140,
    eyebrow: "WHY SAATVIK",
    title: "One platform for your",
    titleEmphasis: "Ayurveda practice journey.",
  },
];

export const heroSlideSeed: Seed<Prisma.HeroSlideCreateInput>[] = [
  {
    key: "launch-your-brand",
    sortOrder: 10,
    eyebrow: "BUILT FOR AYURVEDA PROFESSIONALS",
    title: "Build your Ayurveda brand.",
    titleEmphasis: "We’ll build the rest.",
    body: "Choose from 150+ classical formulations with low MOQ, transparent net rates and end-to-end label support.",
    primaryLabel: "Launch Your Brand",
    primaryHref: "/#launch",
    secondaryLabel: "Watch how it works",
    secondaryHref: "/#reels",
    proof: {
      initials: ["DR", "AV", "+"],
      title: "Built around real practice needs",
      subtitle: "From formulation selection to order tracking",
    },
    panelKind: "LAUNCH_STUDIO",
    panel: {
      label: "Launch Studio",
      step: "Step 1 of 4",
      title: "What would you like to build?",
      searchPlaceholder: "Search formulation",
      pills: ["Vati", "Churna", "Guggulu", "Asava"],
      selectedPill: "Vati",
      product: {
        symbol: "PV",
        name: "Punarnava Mandoor",
        meta: "Classical Ayurveda • Tablet",
      },
      meta: [
        { label: "Suggested MRP", value: "Choose your MRP" },
        { label: "For you", value: "View net rate" },
      ],
      nextLabel: "Continue to label options",
      nextHref: null,
      note: "No payment at this stage",
    },
  },
  {
    key: "top-brands",
    sortOrder: 20,
    eyebrow: "B2B PRODUCT DISCOVERY, SIMPLIFIED",
    title: "Top Ayurveda brands.",
    titleEmphasis: "One trusted platform.",
    body: "Build a flexible order from selected brands, view clear product information and reorder from your profile.",
    primaryLabel: "Explore Top Brands",
    primaryHref: "/#brands",
    secondaryLabel: "Track an order",
    secondaryHref: "modal:track-order",
    panelKind: "BRAND_SHOWCASE",
    panel: {
      floatLabel: "Available for B2B ordering",
      featured: {
        eyebrow: "FEATURED RANGE",
        name: "Sabka Vaidya",
        description: "Classical & wellness portfolio",
        linkLabel: "View range",
        linkHref: null,
      },
      others: [
        { name: "Pranacharya", description: "Professional range" },
        { name: "Flowgra", description: "Focused formulations" },
      ],
    },
  },
  {
    key: "clinical-learning",
    sortOrder: 30,
    eyebrow: "LEARN • APPLY • GROW",
    title: "Clinical learning that",
    titleEmphasis: "moves practice forward.",
    body: "Expert-led courses, Saatvik Live sessions and quick Ayurveda challenges—created for practitioners.",
    primaryLabel: "Explore Courses",
    primaryHref: "/#courses",
    secondaryLabel: "Play this week’s quiz",
    secondaryHref: "/#quiz",
    panelKind: "LEARNING_BOARD",
    panel: {
      badge: "SAATVIK LIVE",
      title: "Clinical Diet Planning",
      subtitle: "प्रकृति, अग्नि एवं रोगावस्था के अनुसार आहार चयन",
      meta: [
        { label: "Upcoming", value: "Monday • 8:00 PM" },
        { label: "Format", value: "Live session" },
      ],
      speaker: {
        initials: "DA",
        name: "Ayurvedacharya Dr. Abhishek",
        role: "Founder, Saatvik Vaidya",
      },
      linkLabel: "Reserve your seat",
      linkHref: null,
    },
  },
];

export const statItemSeed: Seed<Prisma.StatItemCreateInput>[] = [
  {
    key: "formulations",
    sortOrder: 10,
    value: "150+",
    label: "Classical formulations",
  },
  {
    key: "low-moq",
    sortOrder: 20,
    value: "Low MOQ",
    label: "Built for growing practices",
  },
  {
    key: "clear-rates",
    sortOrder: 30,
    value: "Clear Rates",
    label: "Transparent B2B pricing",
  },
  {
    key: "complete-support",
    sortOrder: 40,
    value: "Complete Support",
    label: "Product to label assistance",
  },
];

export const reelSeed: Seed<Prisma.ReelCreateInput>[] = [
  {
    key: "brand-launch",
    sortOrder: 10,
    type: "PRODUCT",
    mediaKind: "VIDEO",
    mediaSrc: "/media/brand-launch.mp4",
    mediaLabel: "Play Launch Your Brand reel",
    badge: "LAUNCH YOUR BRAND",
    badgeTone: "ORANGE",
    metaLabel: "00:36",
    title: "Your product. Your label. Your identity.",
    linkLabel: "Start your brand",
    linkHref: "/#launch",
  },
  {
    key: "product-range",
    sortOrder: 20,
    type: "PRODUCT",
    mediaKind: "VIDEO",
    mediaSrc: "/media/product-range.mp4",
    mediaLabel: "Play product range reel",
    badge: "PRODUCT RANGE",
    badgeTone: "BLUE",
    metaLabel: "00:42",
    title: "Explore low-MOQ Ayurveda formulations.",
    linkLabel: "Explore range",
    linkHref: "/#launch",
  },
  {
    key: "doctor-feedback-letterhead",
    sortOrder: 30,
    type: "FEEDBACK",
    mediaKind: "IMAGE",
    mediaSrc: "/media/doctor-feedback-english.jpg",
    mediaLabel: "Original letterhead feedback shared by an Ayurveda doctor",
    badge: "VERIFIED DOCTOR",
    badgeTone: "GREEN",
    metaLabel: "Original letterhead",
    title: "“Product quality, packaging and support are outstanding.”",
    linkLabel: "Read verified feedback",
    linkHref: "/#feedback",
  },
  {
    key: "saatvik-rewards",
    sortOrder: 40,
    type: "OFFER",
    mediaKind: "IMAGE",
    mediaSrc: "/media/saatvik-rewards.jpg",
    mediaLabel:
      "Saatvik Rewards — earn 1,000 Saatvik Coins on an eligible 10,000 rupee order",
    badge: "SAATVIK REWARDS",
    badgeTone: "GOLD",
    valueLabel: "1,000 Coins = ₹100",
    title: "Every eligible order should reward your growth.",
    linkLabel: "View rewards",
    linkHref: "/#coins",
  },
  {
    key: "nutrition-week-live",
    sortOrder: 50,
    type: "LEARNING",
    mediaKind: "POSTER",
    badge: "LIVE",
    metaLabel: "Monday • 8 PM",
    posterKicker: "NATIONAL NUTRITION WEEK",
    posterText: "सही आहार केवल पोषण नहीं,\nउपचार का आधार है।",
    posterByline: "with Dr. Abhishek",
    title: "Practical diet planning for OPD & IPD.",
    linkLabel: "View sessions",
    linkHref: "/#courses",
  },
];

export const offerSeed: Seed<Prisma.OfferCreateInput>[] = [
  {
    key: "saatvik-rewards",
    sortOrder: 10,
    tone: "ORANGE",
    iconText: "SV",
    eyebrow: "SAATVIK REWARDS",
    title: "₹10,000 order → 1,000 Coins",
    body: "Reward value ₹100 • Valid for 60 months",
    linkLabel: "View Saatvik Rewards",
    linkHref: "/#coins",
  },
  {
    key: "private-label",
    sortOrder: 20,
    tone: "TEAL",
    iconText: "BYB",
    eyebrow: "PRIVATE LABEL",
    title: "Launch without a large inventory burden",
    body: "Low MOQ across selected classical products",
    linkLabel: "Launch your brand",
    linkHref: "/#launch",
  },
  {
    key: "quiz-and-win",
    sortOrder: 30,
    tone: "NAVY",
    iconText: "QW",
    eyebrow: "QUIZ & WIN",
    title: "Learn Ayurveda. Earn rewards.",
    body: "10 questions • 5 minutes • Weekly leaderboard",
    linkLabel: "Play Quiz and Win",
    linkHref: "/#quiz",
  },
];

export const quickActionSeed: Seed<Prisma.QuickActionCreateInput>[] = [
  {
    key: "launch-your-brand",
    sortOrder: 10,
    tone: "ORANGE",
    iconText: "＋",
    title: "Launch Your Brand",
    description: "Start a private-label request",
    href: "/#launch",
  },
  {
    key: "explore-brands",
    sortOrder: 20,
    tone: "TEAL",
    iconText: "TB",
    title: "Explore Top Brands",
    description: "Build your B2B order",
    href: "/#brands",
  },
  {
    key: "track-order",
    sortOrder: 30,
    tone: "BLUE",
    iconText: "⌁",
    title: "Track Your Order",
    description: "View progress and reorder",
    href: "modal:track-order",
  },
  {
    key: "explore-courses",
    sortOrder: 40,
    tone: "GOLD",
    iconText: "▶",
    title: "Explore Courses",
    description: "Learn with expert practitioners",
    href: "/#courses",
  },
];

// The mockup's "By Practice Area" tab has no entries yet, so none are seeded.
export const categorySeed: Seed<Prisma.CategoryCreateInput>[] = [
  {
    key: "vati-gutika",
    kind: "FORM",
    sortOrder: 10,
    name: "Vati & Gutika",
    glyph: "व",
  },
  { key: "churna", kind: "FORM", sortOrder: 20, name: "Churna", glyph: "चू" },
  { key: "guggulu", kind: "FORM", sortOrder: 30, name: "Guggulu", glyph: "गु" },
  {
    key: "asava-arishta",
    kind: "FORM",
    sortOrder: 40,
    name: "Asava–Arishta",
    glyph: "आ",
  },
  { key: "avaleha", kind: "FORM", sortOrder: 50, name: "Avaleha", glyph: "अ" },
  {
    key: "taila-ghrita",
    kind: "FORM",
    sortOrder: 60,
    name: "Taila & Ghrita",
    glyph: "तै",
  },
];

export const brandSeed: Seed<Prisma.BrandCreateInput>[] = [
  {
    key: "sabka-vaidya",
    sortOrder: 10,
    featured: true,
    name: "Sabka Vaidya",
    monogram: "SV",
    tone: "TEAL",
    eyebrow: "FEATURED PORTFOLIO",
    description:
      "Classical Ayurveda and focused wellness products for professional procurement.",
    linkLabel: "Explore range",
    linkHref: null,
  },
  {
    key: "pranacharya",
    sortOrder: 20,
    name: "Pranacharya",
    monogram: "PA",
    tone: "ORANGE",
    eyebrow: "PROFESSIONAL RANGE",
    description: "Explore products across selected Ayurveda categories.",
    linkLabel: "View products",
    linkHref: null,
  },
  {
    key: "flowgra",
    sortOrder: 30,
    name: "Flowgra",
    monogram: "FG",
    tone: "BLUE",
    eyebrow: "FOCUSED RANGE",
    description: "Simple B2B ordering with flexible quantities.",
    linkLabel: "View products",
    linkHref: null,
  },
];

export const courseTeaserSeed: Seed<Prisma.CourseTeaserCreateInput>[] = [
  {
    key: "kidney-care",
    sortOrder: 10,
    tag: "FOUNDATION COURSE",
    title: "Kidney Care for Ayurveda Doctors",
    body: "Clinical assessment, diet planning and structured practice protocols.",
    metaLabel: "Format",
    metaValue: "3-Day Online CME",
    linkLabel: "View course",
    linkHref: null,
  },
];

export const liveSessionSeed: Seed<Prisma.LiveSessionCreateInput>[] = [
  {
    key: "clinical-diet-planning",
    sortOrder: 10,
    tag: "UPCOMING LIVE",
    title: "Clinical Diet Planning",
    body: "प्रकृति, अग्नि एवं रोगावस्था के अनुसार आहार चयन",
    metaLabel: "Next session",
    metaValue: "Monday • 8 PM",
    linkLabel: "Reserve seat",
    linkHref: null,
  },
];

export const feedbackSeed: Seed<Prisma.FeedbackCreateInput>[] = [
  {
    key: "prayag-ayurveda-letterhead",
    sortOrder: 10,
    featured: true,
    imageSrc: "/media/doctor-feedback-hindi.jpg",
    imageAlt: "Original handwritten feedback on Prayag Ayurveda letterhead",
    badge: "VERIFIED LETTERHEAD",
    quote:
      "“औषधियों की उत्कृष्टता और ग्राहकों के प्रति समर्पण वास्तव में प्रशंसनीय है।”",
    caption: "Original handwritten feedback • Shared with consent",
    linkLabel: "Read the original feedback",
    // The original is the photo itself.
    linkHref: "/media/doctor-feedback-hindi.jpg",
  },
];

export const whyStepSeed: Seed<Prisma.WhyStepCreateInput>[] = [
  {
    key: "discover",
    sortOrder: 10,
    title: "Discover",
    body: "Find formulations, brands and learning relevant to your work.",
  },
  {
    key: "build",
    sortOrder: 20,
    title: "Build",
    body: "Create your product identity through a guided request.",
  },
  {
    key: "grow",
    sortOrder: 30,
    title: "Grow",
    body: "Reorder, learn, participate and earn rewards from one profile.",
  },
];
