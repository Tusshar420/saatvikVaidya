import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  bugReportFieldsSchema,
  bugReportLimits,
  countLinks,
  parseSessionErrors,
  screenshotUpload,
  type ScreenshotType,
  type SessionError,
} from "@/lib/bug-report";
import { deviceOf, isBotAgent, scrubText, scrubUrl } from "@/lib/error-scrub";
import { rateLimitRules } from "@/server/auth/policy";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { db } from "@/server/db";
import { fingerprintOf } from "@/server/errors/record";
import { deleteFilesQuietly, getStorage, newFileKey } from "@/server/storage";
import { checkUpload } from "@/server/storage/files";

// "Report a problem" (Phase 4): checks and saves a report from the form.
// Called by POST /api/bug-reports; kept apart from the route so tests can call it.
// Who reported is taken from the session, never from the form.

export type SubmitError = "invalid" | "tooManyLinks" | "rateLimited" | "empty" | "tooLarge" | "fileType";

export type SubmitResult =
  | { ok: true; reportId: number | null }
  | { ok: false; error: SubmitError; retryAfterSeconds?: number };

/** How far back to look for the server error behind an error screen's digest. */
const digestLookbackMs = 2 * 24 * 3600_000;

export async function submitBugReport(input: {
  /** The form's text fields, as sent. */
  fields: Record<string, unknown>;
  screenshot: Uint8Array | null;
  ip: string;
  userAgent: string | null;
  userId: string | null;
  appVersion?: string | null;
  now?: Date;
}): Promise<SubmitResult> {
  const now = input.now ?? new Date();
  const parsed = bugReportFieldsSchema.safeParse(input.fields);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const fields = parsed.data;

  // Bots get a quiet "thank you" and nothing is stored, so they learn nothing.
  if (fields.website || isBotAgent(input.userAgent)) return { ok: true, reportId: null };
  if (!input.userId && countLinks(fields.description) > bugReportLimits.guestLinksMax) {
    return { ok: false, error: "tooManyLinks" };
  }

  let screenshot: { type: ScreenshotType; extension: string } | null = null;
  if (input.screenshot && input.screenshot.byteLength > 0) {
    const checked = checkUpload(input.screenshot, screenshotUpload);
    if (!checked.ok) return { ok: false, error: checked.error };
    screenshot = { type: checked.contentType, extension: checked.extension };
  }

  const limits = [hitRateLimit(rateLimitRules.bugReportPerIp, input.ip)];
  if (input.userId) limits.push(hitRateLimit(rateLimitRules.bugReportPerUser, input.userId));
  else limits.push(hitRateLimit(rateLimitRules.bugReportGuestsPerHour, "all"));
  for (const limit of await Promise.all(limits)) {
    if (!limit.allowed) return { ok: false, error: "rateLimited", retryAfterSeconds: limit.retryAfterSeconds };
  }

  const sessionErrors = parseSessionErrors(fields.sessionErrors);
  const userAgent = input.userAgent ? input.userAgent.slice(0, 255) : null;
  const screenshotKey = screenshot
    ? newFileKey("bug-reports", input.userId ?? "guest", screenshot.extension)
    : null;
  if (screenshotKey && input.screenshot) await getStorage().put(screenshotKey, input.screenshot);

  try {
    const report = await db.bugReport.create({
      data: {
        createdAt: now,
        description: scrubText(fields.description, bugReportLimits.descriptionMax),
        userId: input.userId,
        // Signed-in reporters are reached through their account.
        contactEmail: input.userId ? null : (fields.contactEmail ?? null),
        pageUrl: fields.pageUrl ? scrubUrl(fields.pageUrl).slice(0, 500) : null,
        userAgent,
        device: deviceOf(userAgent),
        screenWidth: fields.screenWidth ?? null,
        screenHeight: fields.screenHeight ?? null,
        viewportWidth: fields.viewportWidth ?? null,
        viewportHeight: fields.viewportHeight ?? null,
        pixelRatio: fields.pixelRatio ?? null,
        appVersion: input.appVersion?.slice(0, 40) ?? null,
        sessionErrors: sessionErrors.length ? storedSessionErrors(sessionErrors) : undefined,
        screenshotKey,
        screenshotType: screenshot?.type ?? null,
      },
      select: { id: true },
    });
    const groupIds = await errorsFromSession(sessionErrors, now);
    if (groupIds.length) {
      await db.bugReportError.createMany({
        data: groupIds.map((groupId) => ({ reportId: report.id, groupId, auto: true })),
        skipDuplicates: true,
      });
    }
    return { ok: true, reportId: report.id };
  } catch (error) {
    if (screenshotKey) await deleteFilesQuietly([screenshotKey]);
    throw error;
  }
}

/** What the report keeps of the visit's errors: short, scrubbed, no stacks (the linked error has those). */
function storedSessionErrors(entries: SessionError[]): Prisma.InputJsonArray {
  return entries.map((entry) => ({
    message: scrubText(entry.message, 300),
    url: scrubUrl(entry.url),
    kind: entry.kind,
    at: new Date(entry.at).toISOString(),
    ...(entry.digest ? { digest: entry.digest.slice(0, 100) } : {}),
  }));
}

/**
 * The Error log entries matching the visit's browser errors: the browser
 * error by its fingerprint (worked out the same way the log does), and for an
 * error screen the server error behind it, by Next's digest.
 */
export async function errorsFromSession(entries: SessionError[], now = new Date()): Promise<number[]> {
  if (entries.length === 0) return [];
  const fingerprints = [
    ...new Set(
      entries.map((entry) =>
        fingerprintOf({ source: "browser", message: entry.message, stack: entry.stack ?? null, route: entry.url }),
      ),
    ),
  ];
  const ids = new Set(
    (await db.errorGroup.findMany({ where: { fingerprint: { in: fingerprints } }, select: { id: true } })).map(
      (group) => group.id,
    ),
  );
  const digests = [...new Set(entries.flatMap((entry) => (entry.digest ? [entry.digest] : [])))];
  for (const digest of digests) {
    const occurrence = await db.errorOccurrence.findFirst({
      where: {
        createdAt: { gte: new Date(now.getTime() - digestLookbackMs) },
        group: { source: "server" },
        context: { path: "$.digest", equals: digest },
      },
      select: { groupId: true },
    });
    if (occurrence) ids.add(occurrence.groupId);
  }
  return [...ids];
}
