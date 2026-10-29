import Link from "next/link";
import { bugReportsAdmin as copy } from "@/content/bug-reports";
import { cn } from "@/lib/cn";

const tabClasses =
  "relative inline-flex min-h-11 shrink-0 items-center gap-2 px-0.5 text-sm font-extrabold whitespace-nowrap transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-orange after:transition-opacity focus-visible:-outline-offset-2";

/**
 * The error log's two sections, automatic errors and problem reports, as
 * underline tabs. They are links (each section is its own page with its own
 * filters), so the current one is marked with aria-current.
 */
export function ErrorLogTabs({ active, newReports }: { active: "errors" | "reports"; newReports: number }) {
  const tabs = [
    { key: "errors", href: "/admin/errors", label: copy.tabs.errors, count: 0 },
    { key: "reports", href: "/admin/errors/reports", label: copy.tabs.reports, count: newReports },
  ] as const;
  return (
    <nav aria-label={copy.tabs.label} className="mt-6">
      <ul className="scrollbar-none flex gap-5 overflow-x-auto border-b border-line">
        {tabs.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  tabClasses,
                  current ? "text-orange-ink after:opacity-100" : "text-muted after:opacity-0 hover:text-ink",
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="rounded-sm bg-danger-soft px-2 py-0.5 text-xs font-extrabold text-danger">
                    {copy.tabs.newCount(tab.count)}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
