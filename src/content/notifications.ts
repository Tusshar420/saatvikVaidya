// Text for in-app notifications: the header's bell, its panel, the
// /notifications page, and the title and line of each notification. The
// messages are saved with the notification when it is created
// (src/server/notify/), so a later change here affects new ones only.

export const notifications = {
  metaTitle: "Notifications",
  eyebrow: "My account",
  title: "Notifications",
  intro: "Updates on your orders, brand orders and account. Tap one to open it.",
  back: "Back to My account",

  /** The header's bell. */
  bell: {
    label: (unread: number) =>
      unread === 0
        ? "Notifications"
        : `Notifications, ${unread} unread`,
    /** The badge caps the count so it fits. */
    badge: (unread: number) => (unread > 99 ? "99+" : String(unread)),
  },

  /** The panel the bell opens. */
  panel: {
    title: "Notifications",
    description: "Your latest updates. Tap one to open it.",
    close: "Close notifications",
    seeAll: "See all notifications",
    loading: "Loading notifications…",
    failed: "We couldn't load your notifications. Please try again.",
    retry: "Try again",
  },

  /** The read/unread filter, on the panel and the page. */
  filters: {
    label: "Show",
    all: "All",
    unread: "Unread",
    read: "Read",
  },

  markAllRead: "Mark all as read",
  markedAllRead: "All notifications marked as read.",
  markRead: "Mark as read",
  unreadLabel: "Unread",
  readLabel: "Read",
  listLabel: "Notifications",
  shown: (count: number) => `Showing your latest ${count} notifications.`,
  failed: "Something went wrong. Please try again.",

  empty: {
    all: {
      title: "No notifications yet",
      body: "Order updates, label proofs and account news will show up here.",
    },
    unread: {
      title: "You're all caught up",
      body: "There's nothing new. Read notifications are under Read and All.",
    },
    read: {
      title: "Nothing read yet",
      body: "Notifications you've opened will show up here.",
    },
  },

  /** "5 min ago", "Yesterday", then a date. */
  time: {
    justNow: "Just now",
    minutes: (n: number) => `${n} min ago`,
    hours: (n: number) => `${n} h ago`,
    yesterday: "Yesterday",
  },

  /** The messages themselves, one per event. */
  messages: {
    orderConfirmed: {
      title: (number: string) => `Order ${number} confirmed`,
      body: (total: string) => `Payment of ${total} received. We'll let you know when it ships.`,
    },
    shipment: {
      title: (number: string, status: string) => `Order ${number}: ${status}`,
    },
    orderCancelled: {
      title: (number: string) => `Order ${number} cancelled`,
      body: (paid: boolean) =>
        paid
          ? "Your order was cancelled. Any payment is refunded to the way you paid."
          : "Your order was cancelled.",
    },
    brandPaid: {
      title: (number: string) => `Brand order ${number} confirmed`,
      body: (total: string) => `Payment of ${total} received. We'll share your label proof soon.`,
    },
    proofSent: {
      title: (number: string, version: number) => `Label proof ${version} ready for ${number}`,
      body: "Please check it and approve it, or ask for changes.",
    },
    brandStage: {
      title: (number: string, stage: string) => `Brand order ${number}: ${stage}`,
    },
    documentReceived: {
      title: (document: string) => `${document} received`,
      body: (complete: boolean) =>
        complete
          ? "All your documents are in. We'll let you know once they're reviewed."
          : "Thank you. Please upload the rest of your documents too.",
    },
    approved: {
      title: "Your account is verified",
      body: "Professional prices are now unlocked.",
    },
    rejected: {
      title: "We couldn't verify your documents",
      body: (comment: string | null) =>
        comment ? `Reason: ${comment}` : "Please upload corrected documents in My account.",
    },
    adminBrandPaid: {
      title: (number: string) => `New brand order ${number}`,
      body: (customer: string, brandName: string, total: string) =>
        `${customer || "A customer"} paid ${total}${brandName ? ` for ${brandName}` : ""}. Send the label proof.`,
    },
    adminProofApproved: {
      title: (number: string) => `Proof approved: ${number}`,
      body: (customer: string, version: number) =>
        `${customer || "The customer"} approved proof ${version}. Production can start.`,
    },
    adminProofChanges: {
      title: (number: string) => `Changes asked for: ${number}`,
      body: (customer: string, version: number, comment: string) =>
        `${customer || "The customer"} asked for changes to proof ${version}${comment ? `: ${comment}` : "."}`,
    },
    adminUploaded: {
      title: (name: string) => `New document from ${name}`,
      body: (document: string, userType: string, complete: boolean) =>
        `${document} (${userType}). ${complete ? "All documents are in; ready to review." : "More documents to come."}`,
    },
  },
} as const;
