// The /account page. Keep user-facing text here so Hindi can be added later.

export const account = {
  metaTitle: "My account",
  eyebrow: "My account",
  title: (name: string) => `Namaste, ${name}.`,
  titleEmphasis: "Your profile, in one place.",
  detailsTitle: "Profile details",
  name: "Name",
  mobile: "Mobile",
  email: "Email",
  userType: "I am a",
  notAdded: "Not added",
  verified: "Verified",
  notVerified: "Not verified",
  statusTitle: "Professional verification",
  status: {
    none: {
      badge: "Not needed",
      text: "Customer accounts don't need verification. You see retail prices (MRP).",
    },
    pending: {
      badge: "Pending",
      text: "Professional prices unlock after our team verifies your documents — document upload is coming soon. Until then you see retail prices (MRP).",
    },
    approved: {
      badge: "Verified",
      text: "Our team has verified your documents. Professional prices are unlocked for your account.",
    },
    rejected: {
      badge: "Not approved",
      text: "We couldn't verify your documents. Call us and we'll help you sort it out.",
    },
  },
  call: (phone: string) => `Call ${phone}`,
  signOut: "Sign out",
} as const;

export type VerificationStatusKey = keyof typeof account.status;
