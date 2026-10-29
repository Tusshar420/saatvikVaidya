// Text for "Report a problem" (Phase 4): the form visitors fill in, their
// list of reports in My account, and the Reports tab of the admin error log.

const mb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** The form, its thank-you and its errors. */
export const reportProblem = {
  trigger: "Report a problem",
  eyebrow: "Help us improve",
  title: "Report a problem",
  description: "Tell us what went wrong and our team will look into it.",
  descriptionLabel: "What went wrong?",
  descriptionHelp: "What were you trying to do, and what happened instead?",
  descriptionPlaceholder: "For example: I tapped Pay and the page went blank.",
  counter: (n: number, max: number) => `${n.toLocaleString("en-IN")} / ${max.toLocaleString("en-IN")}`,
  tooShort: (min: number) => `Please write at least ${min} characters.`,
  screenshotLabel: "Screenshot (optional)",
  screenshotHelp: (maxBytes: number) => `PNG, JPEG or WebP, up to ${mb(maxBytes)}.`,
  removeScreenshot: "Remove screenshot",
  emailLabel: "Your email (optional)",
  emailHelp: "Only if you'd like us to reply.",
  invalidEmail: "Please enter a valid email address, or leave it empty.",
  honeypotLabel: "Leave this field empty",
  attached: (signedIn: boolean) =>
    `We'll also send the page you're on, your device, browser and screen size, the time${
      signedIn ? ", your account" : ""
    } and any errors from this visit. Nothing you typed elsewhere is sent.`,
  submit: "Send report",
  thanks: {
    title: "Thank you for telling us",
    body: "Your report has reached our team. We read every one.",
    signedIn: "You can follow its status in your account.",
    guest: "If you left an email, we may write to you for more details.",
    myReports: "See my reports",
    close: "Close",
  },
  errors: {
    invalid: "Please check the form and try again.",
    tooManyLinks: "Please include no more than 3 links.",
    fileType: "The screenshot must be a PNG, JPEG or WebP image.",
    tooLarge: "The screenshot is too large. Please choose one under 5 MB.",
    rateLimited: "You've sent several reports already. Please try again in a while.",
    failed: "We couldn't send your report. Please try again.",
    network: "We couldn't reach the server. Check your connection and try again.",
  },
} as const;

/** What reporters see as the status of their report. */
export const reportStatusForUser = {
  new: "Received",
  investigating: "In progress",
  fixed: "Fixed",
  ignored: "Won't fix",
} as const;

/** My account → Problem reports. */
export const myReports = {
  metaTitle: "Problem reports",
  back: "My account",
  eyebrow: "Support",
  title: "Problem reports",
  intro: "Problems you've reported, and where each one stands.",
  shown: (max: number) => `Your latest ${max} reports are shown.`,
  emptyTitle: "No reports yet",
  emptyBody: "If something on the site doesn't work, tell us and you'll see its status here.",
  sent: (date: string) => `Sent ${date}`,
  updated: (date: string) => `Updated ${date}`,
  page: "Page",
  screenshot: "Screenshot attached",
  viewScreenshot: "View screenshot",
  statusLabel: "Status",
} as const;

/** Admin: the Reports tab of the error log. */
export const bugReportsAdmin = {
  tabs: {
    label: "Error log",
    errors: "Errors",
    reports: "Reports",
    newCount: (n: number) => `${n} new`,
  },
  metaTitle: "Problem reports",
  eyebrow: "Monitoring",
  title: "Problem reports",
  description:
    "Problems sent by visitors with \"Report a problem\", with the page, device and any errors from their visit.",
  filterLabel: "Filter reports",
  searchLabel: "Search the report",
  searchPlaceholder: "Words from the report",
  from: "Received from",
  to: "Received to",
  count: (n: number) => `${n.toLocaleString("en-IN")} ${n === 1 ? "report" : "reports"}`,
  empty: "No problems reported yet.",
  guest: "Guest",
  columns: {
    report: "Report",
    from: "From",
    status: "Status",
    errors: "Errors",
    received: "Received",
    actions: "Actions",
  },
  linkedCount: (n: number) => (n === 0 ? "None" : `${n} linked`),
  hasScreenshot: "Screenshot",
  view: "View",
  viewLabel: (id: number) => `View report ${id}`,
  back: "All reports",
  detail: {
    metaTitle: "Problem report",
    title: (id: number) => `Report #${id}`,
    received: "Received",
    from: "From",
    contact: "Contact email",
    noContact: "None given",
    page: "Page",
    device: "Device and browser",
    screen: "Screen",
    screenValue: (w: number, h: number, ratio: number | null) =>
      `${w} × ${h}${ratio ? ` at ${Number(ratio.toFixed(2))}x` : ""}`,
    window: "Browser window",
    windowValue: (w: number, h: number) => `${w} × ${h}`,
    version: "App version",
    unknown: "—",
    whatHappened: "What went wrong",
    screenshot: "Screenshot",
    screenshotAlt: (id: number) => `Screenshot sent with report ${id}`,
    openScreenshot: "Open full size",
    noScreenshot: "No screenshot was sent.",
    statusHeading: "Status and note",
    statusHelp: "New → In progress → Fixed or Won't fix. The note is for admins only; the reporter sees the status.",
    noteLabel: "Internal note",
    noteHelp: (max: number) => `Only admins see this. Up to ${max.toLocaleString("en-IN")} characters.`,
    save: "Save",
    saved: "Report updated.",
    sessionErrors: "Errors from this visit",
    sessionErrorsHelp: "Browser errors the reporter's page hit before they sent the report.",
    noSessionErrors: "No browser errors were recorded during this visit.",
    linked: "Linked errors",
    linkedHelp: "Errors in the log this report is about. Errors from the visit are linked automatically.",
    noLinked: "No errors are linked.",
    auto: "From the visit",
    manual: "Linked by an admin",
    unlink: "Unlink",
    unlinkLabel: (id: number) => `Unlink error ${id}`,
    linkLabel: "Link an error",
    linkHelp: "The error's number, or paste the link to its page.",
    linkPlaceholder: "e.g. 42",
    link: "Link error",
    linkedNotice: "Error linked.",
    alreadyLinked: "That error is already linked.",
    unlinkedNotice: "Error unlinked.",
    noError: "There is no error with that number.",
    badReference: "Enter an error number or the link to an error.",
    errorLabel: (id: number, message: string) => `#${id} ${message}`,
    times: (n: number) => `${n.toLocaleString("en-IN")}×`,
  },
  /** On an error's detail page. */
  forError: {
    heading: "Problem reports",
    help: "Reports from visitors linked to this error.",
    none: "No reports are linked to this error.",
  },
} as const;
