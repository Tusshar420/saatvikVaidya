// Text for the error log (Phase 4): the admin pages, the email to admins and
// the error screens visitors see.

export const errorLog = {
  nav: "Error log",
  metaTitle: "Error log",
  eyebrow: "Monitoring",
  title: "Error log",
  description:
    "Every error from the server and from visitors' browsers, grouped so one bug is one row. Nothing sensitive is stored.",
  filterLabel: "Filter errors",
  searchLabel: "Search message",
  searchPlaceholder: "Search the message",
  sourceFilter: "Where",
  statusFilter: "Status",
  routeFilter: "Route contains",
  routePlaceholder: "/orders",
  from: "Last seen from",
  to: "Last seen to",
  sortLabel: "Sort by",
  sorts: { newest: "Newest first", frequent: "Most frequent" },
  invalidDates: "The start date is after the end date.",
  count: (n: number) => `${n.toLocaleString("en-IN")} ${n === 1 ? "error" : "errors"}`,
  empty: "No errors recorded. That's good news.",
  sources: { server: "Server", browser: "Browser" },
  statuses: {
    new: "New",
    investigating: "In progress",
    fixed: "Fixed",
    ignored: "Won't fix",
  },
  columns: {
    error: "Error",
    where: "Where",
    route: "Route",
    status: "Status",
    count: "Times",
    lastSeen: "Last seen",
    actions: "Actions",
  },
  happened: (n: number) => `Happened ${n.toLocaleString("en-IN")} ${n === 1 ? "time" : "times"}`,
  view: "View",
  viewLabel: (message: string) => `View error: ${message}`,
  back: "All errors",
  detail: {
    metaTitle: "Error detail",
    firstSeen: "First seen",
    lastSeen: "Last seen",
    times: "Times it happened",
    route: "Route",
    request: "Request",
    version: "App version",
    users: "Affected users",
    usersNone: "No signed-in users were affected.",
    usersCount: (n: number) => `${n} signed-in ${n === 1 ? "user" : "users"}`,
    stack: "Stack trace",
    noStack: "No stack trace was captured.",
    occurrences: "Latest occurrences",
    occurrencesNote: (kept: number, days: number) =>
      `The latest ${kept} are kept, and none older than ${days} days.`,
    occurrenceColumns: { when: "When", url: "URL", user: "User", device: "Device", version: "Version" },
    guest: "Not signed in",
    context: "Extra details",
    statusHeading: "Status",
    statusHelp:
      "New → In progress → Fixed or Won't fix. If a Fixed error happens again it is reopened as New. Won't fix errors send no emails.",
    save: "Save status",
    saved: "Status updated.",
    reopenedNote: "Reopened automatically after it happened again.",
  },
  errors: { invalid: "That status isn't valid.", gone: "That error no longer exists." },
  email: {
    subject: (message: string, route: string) => `New error on ${route}: ${message.slice(0, 80)}`,
    body: (message: string, source: string, route: string, link: string) =>
      `A new error was recorded.\n\nWhere: ${source}\nRoute: ${route}\nMessage: ${message}\n\nSee the details: ${link}\n\nYou get at most one email per error per hour.`,
  },
} as const;

/** What visitors see when a page crashes. */
export const errorScreen = {
  title: "Something went wrong",
  description:
    "We hit a problem showing this page and have been told about it. Please try again.",
  retry: "Try again",
  home: "Go to the homepage",
  reportLead: "Still not working?",
  reference: (digest: string) => `Reference: ${digest}`,
} as const;
