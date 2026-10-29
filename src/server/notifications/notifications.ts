import "server-only";
import { z } from "zod";
import {
  isSitePath,
  notificationKinds,
  pageLimit,
  sectionKinds,
  type NotificationFilter,
  type NotificationView,
  type SectionCounts,
} from "@/lib/notifications";
import { db } from "@/server/db";

// In-app notifications (the header's bell and /notifications). Rows are
// written by the senders in src/server/notify/ next to the SMS and email
// messages. Every read and write here is scoped to one user id, which the
// callers take from the session, never from the request.

const newNotification = z.object({
  userId: z.string().min(1).max(64),
  kind: z.enum(notificationKinds),
  title: z.string().trim().min(1).transform((value) => clip(value, 160)),
  body: z.string().trim().transform((value) => clip(value, 500)),
  href: z.string().refine(isSitePath, "Notifications only link to pages of this site."),
});

export type NewNotification = z.input<typeof newNotification>;

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/**
 * Saves notifications for one or more users. Never throws: a notification
 * that can't be saved is logged, so it can't undo the payment, order change
 * or decision it is about.
 */
export async function createNotifications(items: readonly NewNotification[]): Promise<number> {
  try {
    const data = items.map((item) => newNotification.parse(item));
    if (data.length === 0) return 0;
    const result = await db.notification.createMany({ data });
    return result.count;
  } catch (error) {
    console.error("createNotifications: not saved.", error);
    return 0;
  }
}

export async function createNotification(item: NewNotification): Promise<boolean> {
  return (await createNotifications([item])) === 1;
}

const viewSelect = {
  id: true,
  kind: true,
  title: true,
  body: true,
  href: true,
  readAt: true,
  createdAt: true,
} as const;

function toView(row: {
  id: number;
  kind: NotificationView["kind"];
  title: string;
  body: string;
  href: string;
  readAt: Date | null;
  createdAt: Date;
}): NotificationView {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    read: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

const readWhere = {
  all: {},
  unread: { readAt: null },
  read: { readAt: { not: null } },
} as const satisfies Record<NotificationFilter, object>;

/** The user's newest notifications first, filtered by read state. */
export async function listNotifications(
  userId: string,
  filter: NotificationFilter = "all",
  limit: number = pageLimit,
): Promise<NotificationView[]> {
  const take = Math.min(Math.max(1, Math.trunc(limit)), pageLimit);
  const rows = await db.notification.findMany({
    where: { userId, ...readWhere[filter] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: viewSelect,
  });
  return rows.map(toView);
}

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

/** Unread notifications per section of the site (see `sectionKinds`). */
export async function unreadBySection(userId: string): Promise<SectionCounts> {
  const rows = await db.notification.groupBy({
    by: ["kind"],
    where: { userId, readAt: null, kind: { in: Object.keys(sectionKinds) as (keyof typeof sectionKinds)[] } },
    _count: { _all: true },
  });
  const counts: SectionCounts = {};
  for (const row of rows) {
    const href = sectionKinds[row.kind as keyof typeof sectionKinds];
    counts[href] = row._count._all;
  }
  return counts;
}

/** Marks one of the user's notifications read. False if it isn't theirs (or doesn't exist). */
export async function markNotificationRead(userId: string, id: number): Promise<boolean> {
  const found = await db.notification.findFirst({
    where: { id, userId },
    select: { readAt: true },
  });
  if (!found) return false;
  if (found.readAt === null) {
    await db.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
  return true;
}

/** Marks every unread notification of the user read; returns how many changed. */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
