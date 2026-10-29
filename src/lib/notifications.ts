// In-app notification rules shared by the server, the bell and the
// /notifications page. Text lives in src/content/notifications.ts.

import { notifications as copy } from "@/content/notifications";
import { formatDayMonth } from "./format";

export const notificationKinds = [
  "order",
  "brand",
  "verification",
  "admin",
  "course",
  "doctor_talk",
  "quiz",
  "top_brands",
] as const;
export type NotificationKind = (typeof notificationKinds)[number];

/**
 * Kinds that belong to a section of the site. Unread ones put a badge on that
 * section's link in the nav rail (keyed by the link's href).
 */
export const sectionKinds = {
  course: "/courses",
  doctor_talk: "/doctor-talk",
  quiz: "/quiz",
  top_brands: "/products",
} as const satisfies Partial<Record<NotificationKind, string>>;

/** Unread notifications per nav link href, e.g. { "/courses": 2 }. */
export type SectionCounts = Partial<Record<string, number>>;

export const notificationFilters = ["all", "unread", "read"] as const;
export type NotificationFilter = (typeof notificationFilters)[number];

export function isNotificationFilter(value: unknown): value is NotificationFilter {
  return notificationFilters.includes(value as NotificationFilter);
}

/** How many the bell's panel shows, and how many the page shows. */
export const panelLimit = 8;
export const pageLimit = 50;

/** What the bell and the page show of one notification. */
export type NotificationView = {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  read: boolean;
  /** ISO time, so it survives the trip to the browser. */
  createdAt: string;
};

/**
 * True for a path on this site ("/orders/abc"), false for anything that
 * could leave it: another origin ("https://…", "//evil.test"), a
 * backslash trick ("/\evil.test"), or a script URL. Notifications only ever
 * open pages of this site.
 */
export function isSitePath(href: string): boolean {
  return (
    href.length > 0 &&
    href.length <= 300 &&
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !href.includes("\\") &&
    // No spaces or control characters (browsers strip some of them).
    ![...href].some((char) => char.charCodeAt(0) <= 0x20 || char.charCodeAt(0) === 0x7f)
  );
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", then "1 Oct". */
export function timeAgo(createdAt: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - createdAt.getTime()) / 60_000);
  if (minutes < 1) return copy.time.justNow;
  if (minutes < 60) return copy.time.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return copy.time.hours(hours);
  if (hours < 48) return copy.time.yesterday;
  return formatDayMonth(createdAt);
}
