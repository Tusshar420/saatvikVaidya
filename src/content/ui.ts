// Default strings for the UI primitives in src/components/ui. Keep
// user-facing text here so Hindi can be added later.

export const ui = {
  loading: "Loading",
  close: "Close",
  viewAll: "View all",
  comingSoon: "Coming soon",
  optional: "Optional",
  phone: {
    countryCode: "+91",
  },
  otp: {
    digitLabel: (index: number, total: number) => `Digit ${index} of ${total}`,
  },
  password: {
    show: "Show password",
    hide: "Hide password",
    strengthLabel: "Password strength",
    strength: {
      empty: "Use at least 8 characters.",
      weak: "Weak. Add more characters, numbers or symbols.",
      fair: "Fair. A longer password is safer.",
      strong: "Strong password.",
    },
  },
  coins: {
    label: "Coins",
    accessibleLabel: (balance: string) => `${balance} Saatvik Coins`,
  },
  stepper: {
    done: "completed",
    current: "current step",
  },
  carousel: {
    roleDescription: "carousel",
    slideRoleDescription: "slide",
    slideLabel: (index: number, total: number) => `${index} of ${total}`,
    goTo: (index: number) => `Show slide ${index}`,
    pause: "Pause slides",
    play: "Play slides",
  },
  toast: {
    /** Read out before each toast by screen readers. */
    announceLabel: "Notification",
    /** Label of the toast region; {hotkey} becomes the jump-to shortcut. */
    regionLabel: "Notifications ({hotkey})",
    dismiss: "Dismiss notification",
  },
} as const;
