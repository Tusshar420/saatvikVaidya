import { z } from "zod";

// "Report a problem" (Phase 4): the limits and checks shared by the form in
// the browser and the server. No "server-only" import on purpose.

export const bugReportLimits = {
  descriptionMin: 10,
  descriptionMax: 2000,
  emailMax: 191,
  /** Links a guest may include before the report looks like spam. */
  guestLinksMax: 3,
  /** Browser errors from the visit sent with a report (the latest ones). */
  sessionErrorsMax: 10,
} as const;

export type ScreenshotType = "image/png" | "image/jpeg" | "image/webp";

/** Screenshots: PNG, JPEG or WebP up to 5 MB, checked again on the server from the file's bytes. */
export const screenshotUpload = {
  maxBytes: 5 * 1024 * 1024,
  types: { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } satisfies Record<
    ScreenshotType,
    string
  >,
} as const;

/** One browser error seen earlier in the visit, as the page remembers it. */
export const sessionErrorSchema = z.object({
  message: z.string().max(1000),
  stack: z.string().max(2000).optional(),
  url: z.string().max(1000),
  kind: z.enum(["error", "unhandledrejection", "boundary"]),
  /** When it happened, in ms since 1970. */
  at: z.number().int().nonnegative(),
  /** Next's digest of a server error behind an error screen. */
  digest: z.string().max(100).optional(),
});
export type SessionError = z.infer<typeof sessionErrorSchema>;

const optionalInt = z.coerce.number().int().min(0).max(100_000).optional().catch(undefined);

/** The report form's fields (multipart text fields), before the server checks them. */
export const bugReportFieldsSchema = z.object({
  description: z
    .string()
    .trim()
    .min(bugReportLimits.descriptionMin)
    .max(bugReportLimits.descriptionMax),
  /** Guests only; blank means "don't reply". */
  contactEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
    z.email().max(bugReportLimits.emailMax).optional(),
  ),
  /** The honeypot: hidden from people, so anything typed here came from a bot. */
  website: z.string().max(500).optional(),
  pageUrl: z.string().max(1000).optional(),
  screenWidth: optionalInt,
  screenHeight: optionalInt,
  viewportWidth: optionalInt,
  viewportHeight: optionalInt,
  pixelRatio: z.coerce.number().min(0.1).max(10).optional().catch(undefined),
  /** JSON array of SessionError; bad entries are dropped, not refused. */
  sessionErrors: z.string().max(40_000).optional(),
});
export type BugReportFields = z.infer<typeof bugReportFieldsSchema>;

/** How many web links the text holds. */
export function countLinks(text: string): number {
  return (text.match(/\bhttps?:\/\/|\bwww\.[a-z0-9-]+\./gi) ?? []).length;
}

/** Parses the form's sessionErrors JSON, keeping only valid entries (the latest few). */
export function parseSessionErrors(json: string | undefined): SessionError[] {
  if (!json) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const valid = raw.flatMap((entry) => {
    const parsed = sessionErrorSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
  return valid.slice(-bugReportLimits.sessionErrorsMax);
}

/** "Chrome 141 on Android", from a user agent; "Unknown browser" when it can't tell. */
export function browserOf(userAgent: string | null | undefined): string {
  if (!userAgent) return "Unknown browser";
  const browsers: [string, RegExp][] = [
    ["Edge", /Edg(?:e|A|iOS)?\/(\d+)/],
    ["Samsung Internet", /SamsungBrowser\/(\d+)/],
    ["Opera", /(?:OPR|Opera)\/(\d+)/],
    ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/],
    ["Chrome", /(?:Chrome|CriOS)\/(\d+)/],
    ["Safari", /Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari/],
  ];
  const systems: [string, RegExp][] = [
    ["Android", /Android/],
    ["iOS", /iPhone|iPad|iPod/],
    ["Windows", /Windows/],
    ["macOS", /Mac OS X|Macintosh/],
    ["Linux", /Linux/],
  ];
  const browser = browsers.find(([, pattern]) => pattern.test(userAgent));
  const system = systems.find(([, pattern]) => pattern.test(userAgent))?.[0];
  const name = browser ? `${browser[0]} ${browser[1].exec(userAgent)?.[1] ?? ""}`.trim() : "Unknown browser";
  return system ? `${name} on ${system}` : name;
}

/** The page part of a stored URL, for display ("/orders/12?tab=x"). */
export function pagePathOf(url: string): string {
  try {
    const parsed = new URL(url, "http://local.invalid");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}
