import type { Metadata } from "next";
import Link from "next/link";
import { BellOff, ChevronLeft } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { MarkAllRead } from "@/components/site/notifications/mark-all-read";
import { NotificationItem } from "@/components/site/notifications/notification-item";
import { EmptyState } from "@/components/ui/empty-state";
import { notifications as copy } from "@/content/notifications";
import { cn } from "@/lib/cn";
import { isNotificationFilter, notificationFilters, pageLimit } from "@/lib/notifications";
import { requireUser } from "@/server/auth/session";
import { listNotifications, unreadCount } from "@/server/notifications/notifications";

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false, follow: false },
};

/**
 * Every notification of the signed-in user, newest first, filtered All /
 * Unread / Read (`?show=`). Each opens its page and is marked read; the bell
 * in the header opens the latest few.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string | string[] }>;
}) {
  const { user } = await requireUser("/notifications");
  const show = (await searchParams).show;
  const filter = isNotificationFilter(show) ? show : "all";
  const [items, unread] = await Promise.all([
    listNotifications(user.id, filter, pageLimit),
    unreadCount(user.id),
  ]);

  return (
    <>
      <PageHero eyebrow={copy.eyebrow} title={copy.title} description={copy.intro} />
      <div className="bg-cream pt-5 pb-19 sm:pt-7 md:pb-24">
        <div className="shell mx-auto max-w-3xl">
          <Link
            href="/account"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-brand underline-offset-4 hover:underline"
          >
            <ChevronLeft aria-hidden className="size-4" />
            {copy.back}
          </Link>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <nav aria-label={copy.filters.label}>
              <ul className="flex gap-1.5">
                {notificationFilters.map((key) => {
                  const current = key === filter;
                  return (
                    <li key={key}>
                      <Link
                        href={key === "all" ? "/notifications" : `/notifications?show=${key}`}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "inline-flex min-h-11 items-center gap-1.5 rounded-[11px] px-3.5 text-small font-extrabold transition",
                          current ? "bg-orange-strong text-white" : "bg-surface text-muted hover:text-ink",
                        )}
                      >
                        {copy.filters[key]}
                        {key === "unread" && unread > 0 && (
                          <span
                            className={cn(
                              "grid h-5 min-w-5 place-items-center rounded-sm px-1 text-[11px]",
                              current ? "bg-white/20 text-white" : "bg-brand text-white",
                            )}
                          >
                            {copy.bell.badge(unread)}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {unread > 0 && <MarkAllRead />}
          </div>

          {items.length === 0 ? (
            <EmptyState
              as="h2"
              className="mt-6"
              icon={<BellOff aria-hidden />}
              title={copy.empty[filter].title}
              description={copy.empty[filter].body}
            />
          ) : (
            <>
              <ul aria-label={copy.listLabel} className="mt-6 flex flex-col gap-2.5">
                {items.map((item) => (
                  <NotificationItem key={item.id} item={item} />
                ))}
              </ul>
              {items.length >= pageLimit && (
                <p className="mt-4 text-small text-muted">{copy.shown(pageLimit)}</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
