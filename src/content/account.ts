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
      text: "Professional prices unlock after our team verifies your documents. Until then you see retail prices (MRP).",
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

  shortcuts: {
    title: "Quick links",
    admin: { label: "Admin panel", help: "Manage the store and approvals." },
    orders: { label: "My orders", help: "Track and review your orders." },
    coins: { label: "Super Coins", help: "Your balance and history." },
    ebooks: { label: "My ebooks", help: "Download what you've bought." },
    addresses: { label: "Saved addresses", help: "Where we deliver." },
    brands: { label: "Brand details", help: "Brands you launch products under." },
    reports: { label: "Problem reports", help: "Problems you've reported and their status." },
    verification: { label: "Verification", help: "Documents and approval status." },
  },

  nameForm: {
    title: "Edit your name",
    label: "Full name",
    save: "Save name",
    saved: "Name updated.",
  },

  emailVerify: {
    send: "Send verification link",
    sent: (email: string) => `We sent a verification link to ${email}. It works for 60 minutes.`,
    failed: "We couldn't send the link. Please try again in a few minutes.",
    tooMany: "Too many requests. Please wait a few minutes and try again.",
    justVerified: "Your email is verified. Thank you.",
  },

  password: {
    title: "Change password",
    current: "Current password",
    next: "New password",
    save: "Change password",
    saved: "Password changed. Your other devices have been signed out.",
    wrongCurrent: "That isn't your current password.",
    none: "You sign in with a code sent to your mobile, so there is no password to change. To set one, sign out and use “Forgot password” on the sign-in screen.",
  },

  notifications: {
    title: "Notifications",
    intro: "Choose how we keep you posted. Account and security messages are always sent.",
    orderSms: "Order updates by SMS",
    orderSmsHelp: "Order confirmed, shipped, delivered or cancelled.",
    orderEmail: "Order updates by email",
    orderEmailHelp: "The same updates, to your email address.",
    marketing: "Offers and news",
    marketingHelp: "Occasional offers, new products and live sessions.",
    save: "Save preferences",
    saved: "Preferences saved.",
  },

  addresses: {
    metaTitle: "Saved addresses",
    eyebrow: "My account",
    title: "Saved addresses",
    back: "Back to my account",
    intro: "These are the addresses you can choose at checkout. Past orders keep the address they were sent to.",
    empty: "You haven't saved an address yet.",
    add: "Add a new address",
    edit: "Edit",
    editLabel: (name: string) => `Edit address for ${name}`,
    remove: "Delete",
    removeLabel: (name: string) => `Delete address for ${name}`,
    removeTitle: "Delete this address?",
    removeConfirm: "Yes, delete",
    cancel: "Cancel",
    removed: "Address deleted.",
    saved: "Address saved.",
    notFound: "That address was already removed.",
    count: (n: number, max: number) => `${n} of ${max} saved`,
  },

  brands: {
    metaTitle: "Brand details",
    eyebrow: "My account",
    title: "Brand details",
    back: "Back to my account",
    intro:
      "Your saved brands are the ones you choose from on Launch Your Brand. Changes here show up the next time you pick a brand there. Orders already placed keep the details they were placed with.",
    count: (n: number, max: number) => `${n} of ${max} saved`,
  },

  errors: {
    name: "Enter your name, 2 to 80 characters.",
    form: "Check the highlighted fields.",
    generic: "That didn't save. Please try again.",
    currentRequired: "Enter your current password.",
  },
} as const;

export type VerificationStatusKey = keyof typeof account.status;
