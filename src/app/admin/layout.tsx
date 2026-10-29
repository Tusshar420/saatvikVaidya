import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSignOut } from "@/components/admin/admin-sign-out";
import { Badge } from "@/components/ui/badge";
import { admin as copy } from "@/content/admin";
import { shell } from "@/content/shell";
import { roleCanAccess } from "@/lib/admin-permissions";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = {
  title: { default: copy.metaTitle, template: `%s · ${copy.metaTitle}` },
  robots: { index: false, follow: false },
};

/**
 * The admin panel frame: a header bar, the section nav (sidebar from 1100 px,
 * a scrolling strip below) and the page. Signed-out visitors are sent to
 * sign-in; signed-in non-admins get a 404. Every page and server action
 * checks requireAdmin() itself too, because a layout doesn't re-render on
 * client-side navigation.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireAdmin();
  const pendingCount = roleCanAccess(user.adminRole, "approvals")
    ? await db.user.count({
        where: {
          verificationStatus: "pending",
          userType: { requiresVerification: true },
        },
      })
    : 0;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface-alt">
      <a
        href="#admin-main"
        className="sr-only z-500 rounded-md bg-brand px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {copy.skipToContent}
      </a>
      <header className="sticky top-0 z-100 border-b border-line bg-surface">
        <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-5">
          <Link
            href="/admin"
            className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-md"
          >
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-mark text-sm font-black text-white"
            >
              {shell.brand.mark}
            </span>
            <span className="truncate text-base font-extrabold text-ink">
              {copy.brand}
            </span>
            <Badge variant="orange">{copy.brandTag}</Badge>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-small text-muted md:inline">
              {user.name}
            </span>
            <Link
              href="/"
              className="hidden min-h-10 items-center gap-1.5 rounded-md px-3 text-small font-bold text-brand hover:bg-brand-soft sm:inline-flex"
            >
              {copy.viewSite}
              <ExternalLink aria-hidden className="size-3.5" />
            </Link>
            <AdminSignOut />
          </div>
        </div>
        <div className="border-t border-line lg:hidden">
          <AdminNav pendingCount={pendingCount} adminRole={user.adminRole ?? null} />
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-line bg-surface p-3 lg:block">
          <div className="sticky top-19 max-h-[calc(100dvh-5.5rem)] overflow-y-auto">
            <AdminNav pendingCount={pendingCount} adminRole={user.adminRole ?? null} />
          </div>
        </aside>
        <main
          id="admin-main"
          tabIndex={-1}
          className="min-w-0 flex-1 px-3 py-6 focus:outline-none sm:px-5 lg:px-8 lg:py-8"
        >
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
