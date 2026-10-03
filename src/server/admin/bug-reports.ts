import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { diffFields, logAdminAction } from "./audit";
import {
  dayEnd,
  dayStart,
  errorStatuses,
  lenient,
  optionalDate,
  optionalText,
  type ErrorStatusKey,
} from "./errors";

// Admin side of "Report a problem" (Phase 4): the Reports tab of the error
// log, one report's detail, status and internal note, and links to errors.
// Reports use the same statuses as errors.

export const reportPageSize = 25;
export const adminNoteMax = 2000;

export const reportFiltersSchema = z.object({
  q: optionalText(100),
  status: lenient(z.enum(errorStatuses)),
  from: optionalDate,
  to: optionalDate,
  page: z.preprocess((v) => Number(Array.isArray(v) ? v[0] : v), z.number().int().min(1).max(10_000)).catch(1),
});
export type ReportFilters = z.infer<typeof reportFiltersSchema>;

export function reportWhere(filters: ReportFilters): Prisma.BugReportWhereInput {
  const created: Prisma.DateTimeFilter = {};
  if (filters.from) created.gte = dayStart(filters.from);
  if (filters.to) created.lte = dayEnd(filters.to);
  return {
    status: filters.status,
    description: filters.q ? { contains: filters.q } : undefined,
    createdAt: Object.keys(created).length ? created : undefined,
  };
}

export async function listReports(filters: ReportFilters) {
  const where = reportWhere(filters);
  const total = await db.bugReport.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / reportPageSize));
  const page = Math.min(filters.page, pageCount);
  const reports = await db.bugReport.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * reportPageSize,
    take: reportPageSize,
    select: {
      id: true,
      createdAt: true,
      status: true,
      description: true,
      pageUrl: true,
      contactEmail: true,
      screenshotKey: true,
      user: { select: { name: true } },
      _count: { select: { errors: true } },
    },
  });
  return { reports, total, page, pageCount };
}

/** Reports still waiting to be looked at, for the tab's count. */
export async function countNewReports(): Promise<number> {
  return db.bugReport.count({ where: { status: "new" } });
}

export async function getReport(id: number) {
  return db.bugReport.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phoneNumber: true } },
      errors: {
        orderBy: { createdAt: "asc" },
        include: {
          group: { select: { id: true, message: true, source: true, status: true, route: true, count: true } },
        },
      },
    },
  });
}

/** Reports linked to one error, for the error's detail page. */
export async function reportsForError(groupId: number) {
  return db.bugReport.findMany({
    where: { errors: { some: { groupId } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: { id: true, createdAt: true, status: true, description: true, user: { select: { name: true } } },
  });
}

export const reportUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(errorStatuses),
  adminNote: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : v),
    z.string().max(adminNoteMax),
  ),
});

/** Sets a report's status and internal note, recorded in the admin log. False if it doesn't exist. */
export async function updateReport(
  actorId: string,
  id: number,
  values: { status: ErrorStatusKey; adminNote: string },
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const report = await tx.bugReport.findUnique({ where: { id }, select: { status: true, adminNote: true } });
    if (!report) return false;
    const next = { status: values.status, adminNote: values.adminNote || null };
    const changes = diffFields(report, next);
    if (Object.keys(changes).length === 0) return true;
    await tx.bugReport.update({ where: { id }, data: next });
    await logAdminAction(tx, { actorId, action: "report.update", resource: "BugReport", resourceId: id, changes });
    return true;
  });
}

/**
 * The error to link: its number, or a pasted link to its page
 * (".../admin/errors/123").
 */
export const errorReference = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    const match = /^\s*(?:\S*\/admin\/errors\/)?#?(\d{1,9})\/?\s*$/.exec(v);
    return match ? Number(match[1]) : v;
  },
  z.number().int().positive(),
);

export const reportLinkSchema = z.object({
  id: z.coerce.number().int().positive(),
  error: errorReference,
});

export type LinkResult = "linked" | "already" | "noReport" | "noError";

/** Links a report to an error in the log by hand, recorded in the admin log. */
export async function linkReportToError(actorId: string, reportId: number, groupId: number): Promise<LinkResult> {
  return db.$transaction(async (tx) => {
    const [report, group] = await Promise.all([
      tx.bugReport.findUnique({ where: { id: reportId }, select: { id: true } }),
      tx.errorGroup.findUnique({ where: { id: groupId }, select: { id: true } }),
    ]);
    if (!report) return "noReport";
    if (!group) return "noError";
    const existing = await tx.bugReportError.findUnique({ where: { reportId_groupId: { reportId, groupId } } });
    if (existing) return "already";
    await tx.bugReportError.create({ data: { reportId, groupId, auto: false } });
    await logAdminAction(tx, {
      actorId,
      action: "report.link",
      resource: "BugReport",
      resourceId: reportId,
      changes: { error: { from: null, to: groupId } },
    });
    return "linked";
  });
}

/** Removes a link (automatic or by hand), recorded in the admin log. False if there was none. */
export async function unlinkReportFromError(actorId: string, reportId: number, groupId: number): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.bugReportError.deleteMany({ where: { reportId, groupId } });
    if (count === 0) return false;
    await logAdminAction(tx, {
      actorId,
      action: "report.unlink",
      resource: "BugReport",
      resourceId: reportId,
      changes: { error: { from: groupId, to: null } },
    });
    return true;
  });
}
