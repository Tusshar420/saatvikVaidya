import "server-only";
import { db } from "@/server/db";

// A reporter's own view of their problem reports (Phase 4). The admin note
// and the linked errors are internal and never selected here.

/** Reports shown on /account/reports, newest first. */
export const ownReportsShown = 50;

export async function listOwnReports(userId: string) {
  const reports = await db.bugReport.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: ownReportsShown,
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      status: true,
      description: true,
      pageUrl: true,
      screenshotKey: true,
    },
  });
  return reports.map(({ screenshotKey, ...report }) => ({ ...report, hasScreenshot: screenshotKey !== null }));
}
export type OwnReport = Awaited<ReturnType<typeof listOwnReports>>[number];

/**
 * A report's screenshot, for its reporter or an admin who may use the error
 * log; null for anyone else, a wrong id or no screenshot (the route answers
 * 404 either way).
 */
export async function findViewableScreenshot(
  reportId: number,
  viewer: { id: string; isAdmin: boolean },
): Promise<{ key: string; contentType: string } | null> {
  const report = await db.bugReport.findUnique({
    where: { id: reportId },
    select: { userId: true, screenshotKey: true, screenshotType: true },
  });
  if (!report?.screenshotKey || !report.screenshotType) return null;
  if (!viewer.isAdmin && report.userId !== viewer.id) return null;
  return { key: report.screenshotKey, contentType: report.screenshotType };
}
