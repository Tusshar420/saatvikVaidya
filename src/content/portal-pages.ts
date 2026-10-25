// Strings for the v2 inner pages built in U.12 and U.13: Courses, Dr. Talk,
// Real Feedback, Why Saatvik and Partner & Grow. Keep user-facing text here
// so Hindi can be added later. Admin-editable content (courses, live
// sessions, feedback, why steps, stats) comes from the database instead.

export type PageHeroCopy = {
  kicker: string;
  title: string;
  description: string;
  sideTitle: string;
  sideText: string;
};

export const portalPages = {
  builtFor: "Built for professionals",
  comingNext: "Coming next",

  courses: {
    metaTitle: "Courses & Saatvik Live",
    hero: {
      kicker: "Courses & Saatvik Live",
      title: "Clinical learning for everyday practice.",
      description:
        "Focused courses, live conversations and practical resources created exclusively for Ayurveda professionals.",
      sideTitle: "Foundation to advanced",
      sideText:
        "Clear learning levels help doctors choose the right starting point and progress confidently.",
    },
    tabsLabel: "Learning sections",
    tabs: {
      courses: "Courses",
      live: "Saatvik Live",
      ebooks: "Ebooks & Resources",
    },
    topicsLabel: "Filter courses by level",
    allTopics: "All topics",
    durationLabel: "Duration",
    instructorLabel: "Instructor",
    viewCourse: "View course",
    enrolSoonTitle: "Enrolment opens soon",
    enrolSoonText:
      "Online enrolment and payment are being set up. Call us to register your interest and we'll keep you posted.",
    call: (phone: string) => `Call ${phone}`,
    emptyCoursesTitle: "New courses are on the way",
    emptyCoursesText:
      "We're preparing the next batch of courses. Check back soon.",
    emptyTopicText: "No courses at this level right now.",
    liveTitle: "Upcoming Saatvik Live",
    liveText: "Practical conversations with experienced professionals.",
    liveSoon: "Booking opens soon",
    emptyLiveTitle: "No live sessions scheduled",
    emptyLiveText: "The next Saatvik Live sessions will be listed here.",
  },

  doctorTalk: {
    metaTitle: "Dr. Talk",
    hero: {
      kicker: "Dr. Talk",
      title: "Discuss. Share. Learn.",
      description:
        "A professional space for Ayurveda doctors to ask questions, discuss de-identified cases and learn through useful clinical conversations.",
      sideTitle: "Led by Verified Doctors",
      sideText:
        "Recognition is based on professional identity and helpful contributions, not follower counts.",
    },
    title: "Professional conversations",
    intro: "Simple, focused and relevant to everyday Ayurveda practice.",
    ask: "Ask a question",
    tabsLabel: "Discussion categories (coming next)",
    tabs: ["Latest", "Questions", "Case discussions", "Expert talks", "Following"],
    feedSoonTitle: "Discussions open soon",
    feedSoonText:
      "Dr. Talk is being prepared for verified Ayurveda doctors. Questions, case discussions and expert talks will appear here.",
    feedSoonAction: "Explore courses meanwhile",
    doctorsTitle: "Verified Doctors",
    doctorsText: "Professional contributors",
    doctorsSoon:
      "A list of verified doctors who post in Dr. Talk is coming soon.",
    standardTitle: "Professional discussion standard",
    standardText:
      "Do not share patient names, photographs or identifying details. Posts represent professional discussion and do not replace independent clinical judgment.",
    talksTitle: "Dr. Talks",
    talksText:
      "Expert videos, live conversations and short practical explainers will appear here.",
  },

  feedback: {
    metaTitle: "Satvik Reels",
    hero: {
      kicker: "Satvik Reels",
      title: "Real experiences. Original words.",
      description:
        "Doctor videos, original letterheads and product-received feedback shared with consent, without rewriting what the contributor said.",
      sideTitle: "Authenticity first",
      sideText:
        "Every published feedback item shows its original source and consent status.",
    },
    filtersLabel: "Filter feedback",
    filters: {
      all: "All feedback",
      letterheads: "Letterheads",
      videos: "Videos",
      products: "Products received",
    },
    consent: "Shared with consent",
    viewOriginal: "View original",
    modalTitle: "Original feedback",
    modalText:
      "The original is shown without rewriting the contributor's words.",
    videoBadge: "Verified video",
    videoTitle: "Video feedback",
    videoCaption: "Doctor-approved video preview",
    videoCardTitle: "Doctor video feedback",
    videoCardText:
      "Video feedback will play only after consent and identity verification.",
    productsTitle: "Products-received feedback",
    productsText:
      "Photos and notes from doctors who received their orders will appear here.",
    emptyTitle: "Feedback is being collected",
    emptyText: "Original feedback shared with consent will appear here soon.",
  },

  why: {
    metaTitle: "Why Saatvik",
    hero: {
      kicker: "Why Saatvik",
      title: "More than a marketplace.",
      description:
        "Saatvik Vaidya brings learning, doctor discussions, Ayurveda products and business opportunities together, helping the Ayurveda community learn, connect, build and grow.",
      sideTitle: "One professional ecosystem",
      sideText:
        "A simple platform designed around the everyday needs of Ayurveda doctors, learners and businesses.",
    },
    purposeKicker: "Our purpose",
    purposeTitle: "Empowering Ayurveda professionals",
    purposeTitleLine2: "at every stage of growth.",
    statsLabel: "Saatvik Vaidya at a glance",
    emptyTitle: "More to share soon",
    emptyText: "We're putting our story into words. Check back soon.",
  },

  partner: {
    metaTitle: "Partner & Grow",
    hero: {
      kicker: "Partner & grow",
      title: "Grow with Saatvik Vaidya.",
      description:
        "Explore clear partnership pathways for Ayurveda businesses, institutions and professional networks.",
      sideTitle: "Relevant opportunities only",
      sideText:
        "Choose the pathway that matches your work. Our team will review and respond within 24–48 working hours.",
    },
    pathways: [
      {
        key: "distributor",
        title: "Distributor / Stockist",
        text: "Explore product distribution opportunities for an eligible geography and network.",
        link: "Check eligibility",
      },
      {
        key: "pharmacy",
        title: "Pharmacy / Ayurveda Store",
        text: "Access selected professional products, repeat ordering and relevant offers.",
        link: "Request details",
      },
      {
        key: "institutional",
        title: "Institutional Collaboration",
        text: "Discuss courses, professional programmes, hospitals or ecosystem-level partnerships.",
        link: "Start a conversation",
      },
    ],
    formTitle: "Request a callback",
    formText: "Share only the details needed to route your request correctly.",
    responseTime: "24–48 working hours",
    soonNote: (phone: string) =>
      `Online callback requests open soon. To talk to our team today, call ${phone}.`,
    fields: {
      name: "Name",
      namePlaceholder: "Your name",
      mobile: "Mobile number",
      mobilePlaceholder: "10-digit number",
      type: "I am interested in",
      typePlaceholder: "Choose a partnership type",
      city: "City / State",
      cityPlaceholder: "Your working location",
      message: "Short message",
      messagePlaceholder: "Tell us what you are looking for",
    },
    submit: "Request callback",
    call: (phone: string) => `Call ${phone}`,
  },
} as const;
