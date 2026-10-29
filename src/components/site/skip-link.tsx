import { shell } from "@/content/shell";

/** First focusable element on every page; jumps past the header to #main. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="fixed top-2 left-2 z-500 -translate-y-[160%] rounded-sm bg-ink px-3.5 py-2.5 text-sm font-bold text-white focus:translate-y-0"
    >
      {shell.skipLink}
    </a>
  );
}
