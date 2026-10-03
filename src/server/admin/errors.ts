import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { logAdminAction } from "./audit";

// Admin side of the error log (Phase 4): the list with filters, one error's
// detail, and status changes.

export const errorStatuses = ["new", "investigating", "fixed", "ignored"] as const;
export type ErrorStatusKey = (typeof errorStatuses)[number];
export const errorSources = ["server", "browser"] as const;
export const errorSorts = ["newest", "frequent"] as const;
export const errorPageSize = 25;

export const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
    z.string().max(max).optional(),
  );
export const optionalDate = z.preprocess(
  (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined),
  z.string().optional(),
);
// An invalid value in the URL means "no filter" instead of an error page.
export const lenient = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

export const errorFiltersSchema = z.object({
  q: optionalText(100),
  source: lenient(z.enum(errorSources)),
  status: lenient(z.enum(errorStatuses)),
  route: optionalText(100),
  from: optionalDate,
  to: optionalDate,
  sort: z.enum(errorSorts).catch("newest"),
  page: z.preprocess((v) => Number(Array.isArray(v) ? v[0] : v), z.number().int().min(1).max(10_000)).catch(1),
});
export type ErrorFilters = z.infer<typeof errorFiltersSchema>;

/** Midnight at the start of a day in India, as a Date (the site's day boundary). */
export const dayStart = (day: string) => new Date(`${day}T00:00:00+05:30`);
export const dayEnd = (day: string) => new Date(`${day}T23:59:59.999+05:30`);

export function errorWhere(filters: ErrorFilters): Prisma.ErrorGroupWhereInput {
  const lastSeen: Prisma.DateTimeFilter = {};
  if (filters.from) lastSeen.gte = dayStart(filters.from);
  if (filters.to) lastSeen.lte = dayEnd(filters.to);
  return {
    source: filters.source,
    status: filters.status,
    route: filters.route ? { contains: filters.route } : undefined,
    message: filters.q ? { contains: filters.q } : undefined,
    lastSeenAt: Object.keys(lastSeen).length ? lastSeen : undefined,
  };
}

export async function listErrors(filters: ErrorFilters) {
  const where = errorWhere(filters);
  const total = await db.errorGroup.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / errorPageSize));
  const page = Math.min(filters.page, pageCount);
  const errors = await db.errorGroup.findMany({
    where,
    orderBy:
      filters.sort === "frequent"
        ? [{ count: "desc" }, { lastSeenAt: "desc" }]
        : [{ lastSeenAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * errorPageSize,
    take: errorPageSize,
    select: {
      id: true,
      source: true,
      message: true,
      route: true,
      method: true,
      statusCode: true,
      status: true,
      count: true,
      lastSeenAt: true,
    },
  });
  return { errors, total, page, pageCount };
}

/** Counts of errors still needing attention, for the dashboard-style badge. */
export async function countNewErrors(): Promise<number> {
  return db.errorGroup.count({ where: { status: "new" } });
}

export async function getError(id: number) {
  const group = await db.errorGroup.findUnique({
    where: { id },
    include: {
      occurrences: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!group) return null;
  const users = new Map<string, string>();
  for (const occurrence of group.occurrences) {
    if (occurrence.user) users.set(occurrence.user.id, occurrence.user.name);
  }
  return { group, affectedUsers: [...users].map(([userId, name]) => ({ id: userId, name })) };
}

export const statusChangeSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(errorStatuses),
});

/** Sets an error's status and records it in the admin log. False if it doesn't exist. */
export async function setErrorStatus(
  actorId: string,
  id: number,
  status: ErrorStatusKey,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const group = await tx.errorGroup.findUnique({ where: { id }, select: { status: true } });
    if (!group) return false;
    if (group.status === status) return true;
    await tx.errorGroup.update({ where: { id }, data: { status } });
    await logAdminAction(tx, {
      actorId,
      action: "error.status",
      resource: "ErrorGroup",
      resourceId: id,
      changes: { status: { from: group.status, to: status } },
    });
    return true;
  });
}
