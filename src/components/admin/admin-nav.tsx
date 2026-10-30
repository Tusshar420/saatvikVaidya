"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { admin as copy } from "@/content/admin";
import type { AdminRoleKey } from "@/lib/admin-permissions";
import { cn } from "@/lib/cn";
import { isCurrentLink, linkGroupsFor, type AdminLink } from "./admin-links";

/**
 * Admin sections, grouped by category. From 1100 px a sidebar with a heading
 * per category; below that a strip under the header that scrolls sideways
 * (the headings are hidden there).
 */
export function AdminNav({
  pendingCount,
  adminRole,
}: {
  pendingCount: number;
  /** Only the sections this role may open are listed (the server refuses the rest). */
  adminRole: AdminRoleKey | null;
}) {
  const pathname = usePathname();
  const groups = linkGroupsFor(adminRole);

  const item = (link: AdminLink) => {
    const current = isCurrentLink(pathname, link.href);
    const Icon = link.icon;
    return (
      <li key={link.href} className="shrink-0">
        <Link
          href={link.href}
          aria-current={current ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm font-semibold whitespace-nowrap transition lg:min-h-10",
            current
              ? "bg-orange-soft font-extrabold text-orange-ink"
              : "text-ink/80 hover:bg-surface-alt hover:text-brand",
          )}
        >
          <Icon aria-hidden className="size-4.5 shrink-0" />
          {link.label}
          {link.href === "/admin/approvals" && pendingCount > 0 && (
            <span className="ml-auto grid min-w-6 place-items-center rounded-sm bg-orange-strong px-1.5 text-xs font-extrabold text-white">
              {pendingCount}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label={copy.nav.label}>
      <ul className="scrollbar-none flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:p-0">
        {groups.map((group, index) => [
          <li
            key={`group-${group.id}`}
            aria-hidden
            className={cn(
              "mb-1 hidden px-3 font-mono text-[11px] font-bold tracking-[0.08em] text-muted uppercase lg:block",
              index === 0 ? "mt-1" : "mt-4 border-t border-line pt-4",
            )}
          >
            {group.label}
          </li>,
          ...group.links.map(item),
        ])}
      </ul>
    </nav>
  );
}
