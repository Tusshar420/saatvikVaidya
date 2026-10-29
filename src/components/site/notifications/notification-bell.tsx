"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Bell, BellOff, CheckCheck, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notifications as copy } from "@/content/notifications";
import { useAuthSession } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import {
  isNotificationFilter,
  notificationFilters,
  panelLimit,
  type NotificationFilter,
  type NotificationView,
} from "@/lib/notifications";
import {
  announceNotificationsChanged,
  NotificationItem,
  notificationsChanged,
} from "./notification-item";

/** How often the unread count is checked while the tab is visible. */
const pollMs = 60_000;

type Loaded = { unread: number; items: NotificationView[] };

async function fetchNotifications(filter: NotificationFilter, limit: number): Promise<Loaded | null> {
  const response = await fetch(`/api/notifications?filter=${filter}&limit=${limit}`, {
    cache: "no-store",
  });
  if (!response.ok) return null;
  const result = (await response.json()) as { ok: boolean } & Partial<Loaded>;
  return result.ok && result.items ? { unread: result.unread ?? 0, items: result.items } : null;
}

/**
 * The header's bell, for signed-in users (nothing shows signed out). The
 * orange badge counts unread notifications. It opens a panel with the latest
 * ones, filtered All / Unread / Read, "Mark all as read" and a link to the
 * full /notifications page; each notification opens its page. A bottom sheet
 * on phones, a drop-down card under the bell from 560 px.
 */
export function NotificationBell({
  initialUnread,
  className,
}: {
  /** The count the server worked out for this page load. */
  initialUnread: number;
  className?: string;
}) {
  const { data } = useAuthSession();
  const signedIn = Boolean(data?.user);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [items, setItems] = useState<NotificationView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [marking, setMarking] = useState(false);
  /** Ignores answers to requests that a newer one replaced. */
  const latest = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  /** From 560 px the card hangs under the bell, wherever the header is. */
  const [anchor, setAnchor] = useState<CSSProperties>({});

  // A new page load from the server brings a fresh count.
  const [serverCount, setServerCount] = useState(initialUnread);
  if (serverCount !== initialUnread) {
    setServerCount(initialUnread);
    setUnread(initialUnread);
  }

  const load = useCallback(async (which: NotificationFilter) => {
    const ticket = ++latest.current;
    setFailed(false);
    const result = await fetchNotifications(which, panelLimit).catch(() => null);
    if (ticket !== latest.current) return;
    if (!result) {
      setFailed(true);
      return;
    }
    setItems(result.items);
    setUnread(result.unread);
  }, []);

  /** Only the count: one item is enough. */
  const refreshCount = useCallback(async () => {
    const result = await fetchNotifications("unread", 1).catch(() => null);
    if (result) setUnread(result.unread);
  }, []);

  // Keep the badge fresh: every minute while the tab is visible, on focus,
  // and when a notification is read somewhere else on the page.
  useEffect(() => {
    if (!signedIn) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refreshCount();
    };
    const timer = window.setInterval(tick, pollMs);
    const onChange = (event: Event) => {
      const count = (event as CustomEvent<{ unread?: number }>).detail?.unread;
      if (typeof count === "number") setUnread(count);
      else void refreshCount();
    };
    window.addEventListener("focus", tick);
    window.addEventListener(notificationsChanged, onChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      window.removeEventListener(notificationsChanged, onChange);
    };
  }, [signedIn, refreshCount]);

  async function markAll() {
    setMarking(true);
    try {
      const response = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!response.ok) throw new Error(String(response.status));
      setUnread(0);
      announceNotificationsChanged(0);
      await load(filter);
    } catch {
      setFailed(true);
    } finally {
      setMarking(false);
    }
  }

  if (!signedIn) return null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next && trigger.current) {
          const box = trigger.current.getBoundingClientRect();
          setAnchor({
            "--panel-top": `${Math.round(box.bottom + 8)}px`,
            "--panel-right": `${Math.max(10, Math.round(window.innerWidth - box.right - 8))}px`,
          } as CSSProperties);
        }
        setOpen(next);
        if (next) void load(filter);
        else setItems(null);
      }}
    >
      <Dialog.Trigger
        ref={trigger}
        aria-label={copy.bell.label(unread)}
        data-testid="notification-bell"
        className={cn(
          "relative inline-flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-md px-2 text-brand transition hover:bg-brand-soft/60",
          className,
        )}
      >
        <Bell aria-hidden className="size-5.25" />
        {unread > 0 && (
          <span
            aria-hidden
            data-testid="notification-count"
            className="absolute top-0.5 right-0 grid h-4.5 min-w-4.5 place-items-center rounded-sm bg-orange-strong px-1 text-[11px] font-extrabold text-white"
          >
            {copy.bell.badge(unread)}
          </span>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-300 bg-backdrop backdrop-blur-[8px] data-[state=open]:animate-fade-in sm:bg-transparent sm:backdrop-blur-none" />
        <Dialog.Content
          className={cn(
            "fixed z-300 flex flex-col bg-surface shadow-modal focus:outline-none data-[state=open]:animate-rise-in",
            // Phones: a bottom sheet, 10 px in from the edges.
            "inset-x-2.5 bottom-2.5 max-h-[85dvh] rounded-[24px_24px_15px_15px] pb-[max(12px,env(safe-area-inset-bottom))]",
            // 560 px and up: a card under the bell, at the shell's right edge.
            "sm:inset-x-auto sm:top-(--panel-top) sm:right-(--panel-right) sm:bottom-auto sm:max-h-[min(640px,calc(100dvh-var(--panel-top)-16px))] sm:w-100 sm:rounded-xl sm:border sm:border-line sm:pb-0",
          )}
          style={anchor}
        >
          <span aria-hidden className="mx-auto mt-2.5 block h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
          <div className="flex items-start gap-3 px-5 pt-3 sm:pt-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-heading text-h4 font-extrabold text-ink">
                {copy.panel.title}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-small text-muted">
                {copy.panel.description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton label={copy.panel.close} variant="soft" shape="round" className="-mt-1 -mr-2">
                <X aria-hidden />
              </IconButton>
            </Dialog.Close>
          </div>

          <Tabs
            value={filter}
            onValueChange={(value) => {
              if (!isNotificationFilter(value)) return;
              setItems(null);
              setFilter(value);
              void load(value);
            }}
            className="min-h-0 flex-1"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-5 pt-3">
              <TabsList variant="pill" aria-label={copy.filters.label} className="shrink-0">
                {notificationFilters.map((key) => (
                  <TabsTrigger key={key} value={key}>
                    {copy.filters[key]}
                  </TabsTrigger>
                ))}
              </TabsList>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  disabled={marking}
                  className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-small font-extrabold text-brand underline-offset-4 hover:underline disabled:cursor-wait disabled:opacity-60"
                >
                  <CheckCheck aria-hidden className="size-4" />
                  {copy.markAllRead}
                </button>
              )}
            </div>
            {notificationFilters.map((key) => (
              <TabsContent key={key} value={key} className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-3">
                {failed ? (
                  <div role="alert" className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted">
                    {copy.panel.failed}
                    <button
                      type="button"
                      onClick={() => void load(filter)}
                      className="min-h-11 cursor-pointer rounded-md px-3 font-extrabold text-brand underline-offset-4 hover:underline"
                    >
                      {copy.panel.retry}
                    </button>
                  </div>
                ) : items === null ? (
                  <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
                    <Spinner className="size-4" />
                    {copy.panel.loading}
                  </p>
                ) : items.length === 0 ? (
                  <EmptyState
                    as="h3"
                    className="mx-2 my-1 py-8"
                    icon={<BellOff aria-hidden />}
                    title={copy.empty[key].title}
                    description={copy.empty[key].body}
                  />
                ) : (
                  <ul aria-label={copy.listLabel} className="flex flex-col gap-1.5">
                    {items.map((item) => (
                      <NotificationItem key={item.id} item={item} compact onOpen={() => setOpen(false)} />
                    ))}
                  </ul>
                )}
              </TabsContent>
            ))}
          </Tabs>

          <div className="shrink-0 border-t border-line px-5 py-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center justify-center text-sm font-extrabold text-brand underline-offset-4 hover:underline"
            >
              {copy.panel.seeAll}
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
