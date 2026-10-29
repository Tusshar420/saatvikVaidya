"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, GraduationCap, MessageSquareText, Package, ShieldCheck, Sparkles, Store, Trophy } from "lucide-react";
import { IconTile, type IconTileTone } from "@/components/ui/icon-tile";
import { notifications as copy } from "@/content/notifications";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { timeAgo, type NotificationKind, type NotificationView } from "@/lib/notifications";

/** Fired on `window` whenever notifications change, so the bell can catch up. */
export const notificationsChanged = "sv:notifications-changed";

export function announceNotificationsChanged(unread?: number): void {
  window.dispatchEvent(new CustomEvent(notificationsChanged, { detail: { unread } }));
}

/**
 * Marks a notification read. `keepalive` lets the request finish while the
 * browser is already on its way to the notification's page.
 */
export function sendMarkRead(id: number): void {
  void fetch(`/api/notifications/${id}/read`, { method: "POST", keepalive: true })
    .then(async (response) => {
      const result = (await response.json()) as { ok: boolean; unread?: number };
      if (result.ok) announceNotificationsChanged(result.unread);
    })
    .catch(() => {
      // Not marked read; it stays unread and can be opened again.
    });
}

const kindLook: Record<NotificationKind, { tone: IconTileTone; icon: typeof Package }> = {
  order: { tone: "brand", icon: Package },
  brand: { tone: "orange", icon: Sparkles },
  verification: { tone: "blue", icon: BadgeCheck },
  admin: { tone: "gold", icon: ShieldCheck },
  course: { tone: "blue", icon: GraduationCap },
  doctor_talk: { tone: "brand", icon: MessageSquareText },
  quiz: { tone: "orange", icon: Trophy },
  top_brands: { tone: "gold", icon: Store },
};

/**
 * One notification: a link to its page. Unread ones have an orange left
 * edge, a bold title and an orange dot (and say "Unread" to screen readers).
 * Opening one marks it read.
 */
export function NotificationItem({
  item,
  onOpen,
  compact = false,
}: {
  item: NotificationView;
  /** Called after the click, e.g. to close the bell's panel. */
  onOpen?: () => void;
  /** The bell's panel: tighter, the line clipped to two rows. */
  compact?: boolean;
}) {
  /** Opened here, before the list reloads with it marked read. */
  const [opened, setOpened] = useState(false);
  const read = item.read || opened;
  const look = kindLook[item.kind];
  const Icon = look.icon;
  const created = new Date(item.createdAt);

  function open() {
    if (!read) {
      setOpened(true);
      sendMarkRead(item.id);
    }
    onOpen?.();
  }

  return (
    <li data-testid="notification" data-read={read ? "true" : "false"}>
      <Link
        href={item.href}
        onClick={open}
        // A middle click opens a new tab; it still counts as opening it.
        onAuxClick={(event) => {
          if (event.button === 1 && !read) {
            setOpened(true);
            sendMarkRead(item.id);
          }
        }}
        className={cn(
          "group flex gap-3 rounded-lg border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          compact ? "p-3" : "p-4 sm:p-4.5",
          // Unread: an orange edge on the left; read: quieter.
          read
            ? compact
              ? "border-transparent bg-surface hover:border-line hover:bg-surface-alt"
              : "border-line bg-surface/70 hover:bg-surface"
            : "border-orange/35 border-l-4 border-l-orange-strong bg-surface shadow-card hover:border-orange/60",
        )}
      >
        <IconTile tone={look.tone} aria-hidden className="shrink-0">
          <Icon />
        </IconTile>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 text-sm break-words text-ink group-hover:text-brand",
                read ? "font-semibold" : "font-extrabold",
              )}
            >
              <span className="sr-only">{read ? copy.readLabel : copy.unreadLabel}: </span>
              {item.title}
            </span>
            {!read && (
              <span aria-hidden className="mt-1.5 size-2.25 shrink-0 rounded-full bg-orange-strong" />
            )}
          </span>
          {item.body && (
            <span
              className={cn(
                "mt-0.5 block text-small break-words text-muted",
                compact && "line-clamp-2",
              )}
            >
              {item.body}
            </span>
          )}
          <time
            dateTime={item.createdAt}
            title={formatDateTime(created)}
            className="mt-1 block text-[11px] font-bold tracking-wide text-muted uppercase"
            suppressHydrationWarning
          >
            {timeAgo(created)}
          </time>
        </span>
      </Link>
    </li>
  );
}
