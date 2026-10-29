import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import {
  deviceOf,
  fingerprintText,
  normalizeRoute,
  scrubText,
  scrubUrl,
  scrubValue,
} from "@/lib/error-scrub";
import { db } from "@/server/db";
import { sendNewErrorEmail } from "@/server/notify/errors";

// Recording errors (Phase 4). recordError() never throws: an error logger
// that fails must not turn one error into two.

/** Occurrences kept per error; the group's count keeps the true total. */
export const occurrencesKept = 20;
/** Occurrences older than this are deleted. */
export const retentionDays = 90;
/** At most one email per error per this long. */
export const notifyEveryMs = 60 * 60 * 1000;

export type ErrorInput = {
  source: "server" | "browser";
  message: string;
  stack?: string | null;
  /** Route pattern or path; ids are normalised for grouping. */
  route: string;
  /** Full URL or path of the request/page (scrubbed before saving). */
  url?: string | null;
  method?: string | null;
  statusCode?: number | null;
  userId?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
  /** Small extras; scrubbed and size-capped. Never pass request bodies. */
  context?: Record<string, unknown> | null;
  /** Skip creating a brand-new group (used to cap floods). Existing groups still count. */
  allowNewGroup?: () => Promise<boolean>;
};

export function fingerprintOf(input: Pick<ErrorInput, "source" | "message" | "stack" | "route">): string {
  return createHash("sha256").update(fingerprintText(input)).digest("hex");
}

export type RecordResult =
  | { recorded: true; groupId: number; created: boolean; reopened: boolean }
  | { recorded: false };

export async function recordError(input: ErrorInput, now = new Date()): Promise<RecordResult> {
  try {
    return await record(input, now);
  } catch (error) {
    console.error("[errors] couldn't record an error", error);
    return { recorded: false };
  }
}

async function record(input: ErrorInput, now: Date): Promise<RecordResult> {
  const message = scrubText(input.message || "Unknown error", 500);
  const stack = input.stack ? scrubText(input.stack, 4000) : null;
  const route = normalizeRoute(input.route);
  const fingerprint = fingerprintOf({ source: input.source, message: input.message, stack: input.stack, route });
  const userAgent = input.userAgent ? input.userAgent.slice(0, 255) : null;
  const appVersion = input.appVersion?.slice(0, 40) ?? null;
  const method = input.method?.toUpperCase().slice(0, 10) ?? null;
  const context = input.context ? (scrubValue(input.context) as Prisma.InputJsonObject) : undefined;

  const existing = await db.errorGroup.findUnique({ where: { fingerprint }, select: { id: true, status: true } });
  if (!existing && input.allowNewGroup && !(await input.allowNewGroup())) return { recorded: false };

  let group: { id: number; status: string } | null = null;
  let created = false;
  let reopened = false;
  if (!existing) {
    try {
      group = await db.errorGroup.create({
        data: {
          fingerprint,
          source: input.source,
          message,
          stack,
          route,
          method,
          statusCode: input.statusCode ?? null,
          firstSeenAt: now,
          lastSeenAt: now,
          appVersion,
        },
        select: { id: true, status: true },
      });
      created = true;
    } catch {
      // Lost a race to create it: count it as another occurrence below.
    }
  }
  if (!group) {
    // A fixed error that happens again is reopened.
    reopened = (await db.errorGroup.updateMany({ where: { fingerprint, status: "fixed" }, data: { status: "new" } })).count > 0;
    group = await db.errorGroup.update({
      where: { fingerprint },
      data: { count: { increment: 1 }, lastSeenAt: now, appVersion },
      select: { id: true, status: true },
    });
  }

  await db.errorOccurrence.create({
    data: {
      groupId: group.id,
      createdAt: now,
      url: input.url ? scrubUrl(input.url) : null,
      method,
      statusCode: input.statusCode ?? null,
      userId: input.userId ?? null,
      userAgent,
      device: deviceOf(userAgent),
      appVersion,
      stack,
      context,
    },
  });
  await trimOccurrences(group.id);

  if ((created || reopened) && group.status !== "ignored") void notifyAdmins(group.id, now);
  // Now and then, apply the retention rule.
  if (Math.random() < 0.01) void deleteOldErrors(now);
  return { recorded: true, groupId: group.id, created, reopened };
}

async function trimOccurrences(groupId: number): Promise<void> {
  const cutoff = await db.errorOccurrence.findFirst({
    where: { groupId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: occurrencesKept,
    select: { id: true },
  });
  if (cutoff) await db.errorOccurrence.deleteMany({ where: { groupId, id: { lte: cutoff.id } } });
}

/** Emails the admins about a new or reopened error, at most once an hour per error. */
export async function notifyAdmins(groupId: number, now = new Date()): Promise<boolean> {
  try {
    const claimed = await db.errorGroup.updateMany({
      where: {
        id: groupId,
        OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: new Date(now.getTime() - notifyEveryMs) } }],
      },
      data: { lastNotifiedAt: now },
    });
    if (claimed.count === 0) return false;
    return await sendNewErrorEmail(groupId);
  } catch (error) {
    console.error("[errors] couldn't email admins about an error", error);
    return false;
  }
}

/** Deletes occurrences (and errors) not seen for 90 days. Returns how many occurrences went. */
export async function deleteOldErrors(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 3600_000);
  try {
    const { count } = await db.errorOccurrence.deleteMany({ where: { createdAt: { lt: cutoff } } });
    await db.errorGroup.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });
    return count;
  } catch (error) {
    console.error("[errors] couldn't delete old errors", error);
    return 0;
  }
}

/**
 * For errors that are caught but should still be recorded (a payment or
 * webhook failure, say). Never throws. `context` is scrubbed; pass ids and
 * short facts, never request bodies.
 */
export async function logError(
  error: unknown,
  context: { where: string; userId?: string | null; [key: string]: unknown },
): Promise<void> {
  const { where, userId, ...extra } = context;
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Non-Error thrown");
  await recordError({
    source: "server",
    message: err.message || err.name,
    stack: err.stack ?? null,
    route: where,
    userId: userId ?? null,
    statusCode: 500,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    context: { caught: true, ...extra },
  });
}
