"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { shell } from "@/content/shell";

export type HeaderSearchProps = {
  popularSearches: readonly string[];
  className?: string;
};

const searchHref = (q: string) => `/search?q=${encodeURIComponent(q)}`;

/**
 * Header search. From 820 px up: a search field with a ⌘K hint and a
 * popular-searches popover while it's focused and (nearly) empty. On phones:
 * an icon linking to /search. Submitting goes to /search.
 */
export function HeaderSearch({
  popularSearches,
  className,
}: HeaderSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [query, setQuery] = useState("");
  const headingId = useId();

  const showPopover =
    focused &&
    !dismissed &&
    query.trim().length < 2 &&
    popularSearches.length > 0;

  // ⌘K / Ctrl+K: focus the field, or open /search where the field is hidden.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k")
        return;
      event.preventDefault();
      const input = inputRef.current;
      if (input && input.offsetParent !== null) {
        input.focus();
        input.select();
      } else {
        router.push("/search");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <div
      className={cn("relative", className)}
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
          setDismissed(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && showPopover) {
          event.stopPropagation();
          setDismissed(true);
          inputRef.current?.focus();
        }
      }}
    >
      <Link
        href="/search"
        aria-label={shell.search.openSearch}
        className="grid size-11 place-items-center rounded-md bg-surface-alt text-brand transition hover:bg-brand-soft md:hidden"
      >
        <Search aria-hidden className="size-5" />
      </Link>

      <form
        role="search"
        action="/search"
        method="get"
        aria-label={shell.search.label}
        className="flex h-11.5 items-center gap-2.5 rounded-[14px] border border-line bg-surface-alt pr-3 pl-3.75 transition focus-within:border-brand max-md:hidden"
      >
        <Search aria-hidden className="size-4.75 shrink-0 text-brand" />
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setDismissed(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && showPopover) {
              event.preventDefault();
              popoverRef.current?.querySelector("a")?.focus();
            }
          }}
          aria-label={shell.search.label}
          aria-keyshortcuts="Meta+K Control+K"
          placeholder={shell.search.placeholder}
          autoComplete="off"
          enterKeyHint="search"
          maxLength={100}
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd
          aria-hidden
          className="rounded-[6px] border border-line-strong bg-surface px-1.5 py-0.5 font-sans text-[11px] leading-[1.4] whitespace-nowrap text-muted"
        >
          {shell.search.shortcutHint}
        </kbd>
      </form>

      {showPopover && (
        <div
          ref={popoverRef}
          // Keeps focus in the field while a suggestion is clicked, so the
          // popover doesn't close (and unmount the link) mid-click.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-[calc(100%+9px)] z-10 rounded-[15px] border border-line bg-surface p-3 shadow-raised max-md:hidden"
        >
          <p
            id={headingId}
            className="text-xs font-bold tracking-[0.08em] text-muted uppercase"
          >
            {shell.search.popularTitle}
          </p>
          <ul
            aria-labelledby={headingId}
            className="mt-2 flex flex-wrap gap-1.75"
          >
            {popularSearches.map((term) => (
              <li key={term}>
                <Link
                  href={searchHref(term)}
                  onClick={() => {
                    setQuery(term);
                    inputRef.current?.blur();
                  }}
                  className="inline-flex min-h-11 items-center rounded-sm border border-line bg-surface-alt px-3 text-small text-ink transition hover:border-brand hover:text-brand"
                >
                  {term}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
