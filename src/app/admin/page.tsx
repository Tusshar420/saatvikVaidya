import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  Clapperboard,
  GraduationCap,
  ListChecks,
  Package,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { ActivityList } from "@/components/admin/activity-list";
import { AdminPageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconTile, type IconTileTone } from "@/components/ui/icon-tile";
import { admin as copy } from "@/content/admin";
import { formatNumber } from "@/lib/format";
import { readDashboard } from "@/server/admin/dashboard";
import { countOrdersToShip } from "@/server/admin/orders";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.dashboard.metaTitle };

const text = copy.dashboard;

export default async function AdminDashboardPage() {
  await requireAdmin();
  const [summary, orders] = await Promise.all([readDashboard(), countOrdersToShip()]);

  return (
    <>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
      />

      <section aria-label={text.title} className="mt-6">
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat
            icon={<Users />}
            label={text.stats.users}
            value={formatNumber(summary.users)}
            href="/admin/users"
          />
          <Stat
            icon={<Stethoscope />}
            tone="blue"
            label={text.stats.professionals}
            value={formatNumber(summary.professionals)}
            href="/admin/users"
          />
          <Stat
            icon={<BadgeCheck />}
            tone="orange"
            label={text.stats.pending}
            value={formatNumber(summary.pending)}
            href="/admin/approvals"
            highlight={summary.pending > 0}
          />
          <Stat
            icon={<Package />}
            tone="gold"
            label={text.stats.orders}
            value={formatNumber(orders.total)}
            note={text.stats.ordersToShip(orders.toShip)}
            highlight={orders.toShip > 0}
            href="/admin/orders"
          />
        </ul>
      </section>

      {summary.pending > 0 && (
        <Link
          href="/admin/approvals"
          className={buttonClasses({ className: "mt-5 max-sm:w-full" })}
        >
          {text.reviewPending}
        </Link>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card as="section" aria-labelledby="dashboard-content">
          <h2 id="dashboard-content" className="text-h3 text-ink">
            {text.contentTitle}
          </h2>
          <ul className="mt-4 flex flex-col divide-y divide-line">
            <ContentRow
              icon={<Clapperboard />}
              label={text.stats.reels}
              href="/admin/content/reels"
              {...summary.content.reels}
            />
            <ContentRow
              icon={<Building2 />}
              label={text.stats.brands}
              href="/admin/content/brands"
              {...summary.content.brands}
            />
            <ContentRow
              icon={<GraduationCap />}
              label={text.stats.courses}
              href="/admin/content/courses"
              {...summary.content.courses}
            />
            <ContentRow
              icon={<ListChecks />}
              label={text.stats.quizzes}
              href="/admin/content/quiz"
              {...summary.content.quizzes}
            />
          </ul>
          <p className="mt-4 flex items-center gap-2 text-small text-muted">
            <ShieldCheck aria-hidden className="size-4 text-teal" />
            {copy.common.count(summary.admins, "admin", "admins")}
          </p>
        </Card>

        <Card as="section" aria-labelledby="dashboard-activity">
          <h2 id="dashboard-activity" className="text-h3 text-ink">
            {text.activityTitle}
          </h2>
          <ActivityList items={summary.activity} empty={text.activityEmpty} />
        </Card>
      </div>
    </>
  );
}

function Stat({
  icon,
  tone = "teal",
  label,
  value,
  note,
  href,
  highlight = false,
}: {
  icon: ReactNode;
  tone?: IconTileTone;
  label: string;
  value: string;
  note?: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card transition hover:border-teal/40 hover:shadow-raised sm:p-5"
      >
        <IconTile tone={tone}>{icon}</IconTile>
        <span className="flex flex-col">
          <span
            className={
              highlight
                ? "text-3xl font-extrabold tracking-tight text-orange-ink"
                : "text-3xl font-extrabold tracking-tight text-ink"
            }
          >
            {value}
          </span>
          <span className="text-small font-semibold text-muted">{label}</span>
          {note && <span className="mt-1 text-xs text-muted">{note}</span>}
        </span>
      </Link>
    </li>
  );
}

function ContentRow({
  icon,
  label,
  href,
  total,
  active,
}: {
  icon: ReactNode;
  label: string;
  href: string;
  total: number;
  active: number;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-14 items-center gap-3 py-2 text-sm font-semibold text-ink hover:text-teal"
      >
        <IconTile tone="teal" className="size-9 [&_svg]:size-4.5">
          {icon}
        </IconTile>
        <span className="flex-1">{label}</span>
        <span className="text-small font-medium text-muted">
          {text.activeOf(active, total)}
        </span>
      </Link>
    </li>
  );
}
