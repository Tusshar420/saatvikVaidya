"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ChevronRight,
  CornerDownLeft,
  Search,
  SquareTerminal,
} from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { admin } from "@/content/admin";
import { ui } from "@/content/ui";
import type { AdminRoleKey } from "@/lib/admin-permissions";
import { cn } from "@/lib/cn";
import {
  consoleAddress,
  isCurrentLink,
  linkGroupsFor,
  quickActionsFor,
  searchLinks,
  type AdminLink,
} from "./admin-links";

const copy = admin.console;

const OpenContext = createContext<(() => void) | null>(null);

function useOpenConsole(): () => void {
  const open = useContext(OpenContext);
  if (!open)
    throw new Error("Admin search buttons must sit inside AdminConsole.");
  return open;
}

/** True on Apple devices, where the shortcut is ⌘K rather than Ctrl K. */
function useIsMac(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

/**
 * The admin search console. Wraps the admin frame so the sidebar button, the
 * phone header button and Ctrl/⌘ K all open one dialog: type to filter the
 * pages and quick actions this admin may open, arrows to move, Enter to go.
 * An address typed from "/admin" opens that page.
 */
export function AdminConsole({
  adminRole,
  children,
}: {
  adminRole: AdminRoleKey | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <OpenContext.Provider value={() => setOpen(true)}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        {open && (
          <ConsolePanel adminRole={adminRole} onDone={() => setOpen(false)} />
        )}
      </Dialog.Root>
    </OpenContext.Provider>
  );
}

type Row = { link: AdminLink; group: string };

function ConsolePanel({
  adminRole,
  onDone,
}: {
  adminRole: AdminRoleKey | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const all = useMemo<Row[]>(
    () => [
      ...linkGroupsFor(adminRole).flatMap((group) =>
        group.links.map((link) => ({ link, group: group.label })),
      ),
      ...quickActionsFor(adminRole).map((link) => ({
        link,
        group: copy.actionsGroup,
      })),
    ],
    [adminRole],
  );

  const address = consoleAddress(query);
  const rows = useMemo<Row[]>(() => {
    if (address) {
      return [
        {
          link: {
            href: address,
            label: copy.goTo(address),
            icon: ChevronRight,
            area: "dashboard",
          },
          group: copy.goToGroup,
        },
      ];
    }
    return searchLinks(query, all);
  }, [address, query, all]);

  const selected = Math.min(active, Math.max(rows.length - 1, 0));
  const optionId = (index: number) => `${listId}-option-${index}`;

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const go = (row: Row | undefined) => {
    if (!row) return;
    onDone();
    router.push(row.link.href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(rows.length ? (selected + 1) % rows.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(rows.length ? (selected - 1 + rows.length) % rows.length : 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(rows[selected]);
    }
  };

  // Group headings only while browsing; a search shows one ranked list.
  const grouped = query.trim() === "";

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-300 bg-backdrop backdrop-blur-[6px] data-[state=open]:animate-fade-in" />
      <Dialog.Content
        aria-describedby={undefined}
        className={cn(
          "fixed inset-x-2.5 top-2.5 z-300 flex max-h-[calc(100dvh-20px)] flex-col overflow-hidden rounded-[18px] border border-brand-mid bg-night text-night-ink shadow-modal focus:outline-none data-[state=open]:animate-rise-in",
          "sm:inset-x-auto sm:top-[12vh] sm:left-1/2 sm:max-h-[70vh] sm:w-[min(640px,calc(100%-40px))] sm:-translate-x-1/2",
        )}
      >
        <div className="flex items-center gap-2 border-b border-brand-mid px-4 py-2.5">
          <SquareTerminal aria-hidden className="size-4 text-brand-light" />
          <Dialog.Title className="font-mono text-xs font-bold tracking-[0.08em] text-night-ink uppercase">
            {copy.title}
          </Dialog.Title>
          {/* Tappable too: phones have no Esc key. */}
          <Dialog.Close
            aria-label={ui.close}
            className="-my-2 ml-auto grid min-h-10 min-w-10 cursor-pointer place-items-center"
          >
            <kbd className="rounded-sm border border-brand-mid px-1.5 font-mono text-[11px] text-night-ink">
              esc
            </kbd>
          </Dialog.Close>
        </div>
        <label className="flex items-center gap-2 px-4 py-3 font-mono text-sm">
          <span aria-hidden className="shrink-0 text-brand-light">
            {copy.prompt}
            <span className="text-gold-light"> ~ </span>$
          </span>
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={rows.length ? optionId(selected) : undefined}
            aria-autocomplete="list"
            aria-label={copy.button}
            placeholder={copy.placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
            className="min-h-10 min-w-0 flex-1 bg-transparent font-mono text-base text-white caret-brand-light outline-none placeholder:text-night-ink/60 sm:text-sm"
          />
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-brand-mid px-2 py-2">
          {rows.length === 0 ? (
            <div className="px-3 py-6 font-mono text-sm">
              <p className="text-white">{copy.empty(query.trim())}</p>
              <p className="mt-1.5 text-night-ink">{copy.emptyHint}</p>
            </div>
          ) : (
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={copy.resultsLabel}
            >
              {rows.map((row, index) => {
                const Icon = row.link.icon;
                const isActive = index === selected;
                const showHeading =
                  (grouped || address) &&
                  (index === 0 || rows[index - 1]!.group !== row.group);
                return (
                  <li key={`${row.group}-${row.link.href}`} role="presentation">
                    {showHeading && (
                      <p
                        aria-hidden
                        className="px-3 pt-3 pb-1 font-mono text-[11px] font-bold tracking-[0.08em] text-gold-light uppercase"
                      >
                        # {row.group}
                      </p>
                    )}
                    <div
                      id={optionId(index)}
                      data-index={index}
                      role="option"
                      aria-selected={isActive}
                      onMouseMove={() => setActive(index)}
                      onClick={() => go(row)}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 font-mono text-sm",
                        isActive ? "bg-brand-mid text-white" : "text-night-ink",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "w-3 shrink-0",
                          isActive ? "text-brand-light" : "text-transparent",
                        )}
                      >
                        ›
                      </span>
                      <Icon aria-hidden className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {row.link.label}
                      </span>
                      {!grouped && !address && (
                        <span
                          className={cn(
                            "hidden shrink-0 text-xs sm:inline",
                            isActive ? "text-white" : "text-night-ink",
                          )}
                        >
                          {row.group}
                        </span>
                      )}
                      {isCurrentLink(pathname, row.link.href) && (
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full bg-brand-light"
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div
          aria-hidden
          className="hidden items-center gap-4 border-t border-brand-mid px-4 py-2 font-mono text-[11px] text-night-ink sm:flex"
        >
          <span>↑↓ {copy.hints.move}</span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="size-3" /> {copy.hints.open}
          </span>
          <span>esc {copy.hints.close}</span>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

/** The wide search button at the top of the sidebar, showing the shortcut. */
export function AdminSearchButton() {
  const open = useOpenConsole();
  const isMac = useIsMac();
  return (
    <button
      type="button"
      onClick={open}
      aria-keyshortcuts="Control+K Meta+K"
      className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-surface-alt px-3 text-sm text-muted transition hover:border-brand hover:text-brand"
    >
      <Search aria-hidden className="size-4 shrink-0" />
      <span className="flex-1 text-left">{copy.button}</span>
      <kbd className="rounded-sm border border-line bg-surface px-1.5 font-mono text-[11px] text-muted">
        {isMac ? copy.shortcutMac : copy.shortcutOther}
      </kbd>
    </button>
  );
}

/** The search icon in the header on phones and tablets (no sidebar there). */
export function AdminSearchIconButton({ className }: { className?: string }) {
  const open = useOpenConsole();
  return (
    <IconButton
      label={copy.button}
      variant="soft"
      onClick={open}
      className={className}
    >
      <Search aria-hidden />
    </IconButton>
  );
}
