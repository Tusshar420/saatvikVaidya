import "server-only";
import { z } from "zod";
import { isBotAgent, isBrowserNoise } from "@/lib/error-scrub";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { rateLimitRules } from "@/server/auth/policy";
import { recordError } from "./record";

// The browser error endpoint's logic (POST /api/errors), kept apart from the
// route so tests can call it directly.

export const maxReportBytes = 16 * 1024;

export const browserReportSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  stack: z.string().max(8000).optional(),
  /** The script the error came from, when the browser says. */
  filename: z.string().max(500).optional(),
  /** The page the visitor was on. */
  url: z.string().max(1000),
  /** Where it was caught: the window, a promise, or React's error boundary. */
  kind: z.enum(["error", "unhandledrejection", "boundary"]).default("error"),
  digest: z.string().max(100).optional(),
});
export type BrowserReport = z.infer<typeof browserReportSchema>;

export type ReportOutcome = "recorded" | "ignored" | "rate-limited" | "invalid";

export async function handleBrowserReport(input: {
  body: unknown;
  ip: string;
  userAgent: string | null;
  userId: string | null;
  appVersion?: string | null;
}): Promise<ReportOutcome> {
  const parsed = browserReportSchema.safeParse(input.body);
  if (!parsed.success) return "invalid";
  const report = parsed.data;
  // Cheap checks first, so bots and noise don't use up rate-limit rows.
  if (isBotAgent(input.userAgent) || isBrowserNoise(report)) return "ignored";

  if (!(await hitRateLimit(rateLimitRules.errorReportPerIp, input.ip)).allowed) return "rate-limited";
  if (input.userId && !(await hitRateLimit(rateLimitRules.errorReportPerUser, input.userId)).allowed) {
    return "rate-limited";
  }

  const result = await recordError({
    source: "browser",
    message: report.message,
    stack: report.stack ?? null,
    route: report.url,
    url: report.url,
    method: "GET",
    userId: input.userId,
    userAgent: input.userAgent,
    appVersion: input.appVersion ?? null,
    context: { kind: report.kind, digest: report.digest },
    allowNewGroup: async () => (await hitRateLimit(rateLimitRules.errorNewGroupsPerHour, "all")).allowed,
  });
  return result.recorded ? "recorded" : "ignored";
}
