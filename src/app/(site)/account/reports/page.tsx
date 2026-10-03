import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ImageIcon, LifeBuoy } from "lucide-react";
import { SiteModalButton } from "@/components/site/site-modals";
import { Badge, Eyebrow, type BadgeVariant } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { myReports as copy, reportProblem, reportStatusForUser } from "@/content/bug-reports";
import { pagePathOf } from "@/lib/bug-report";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { listOwnReports, ownReportsShown } from "@/server/bug-reports/reports";

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false, follow: false },
};

const statusVariant: Record<keyof typeof reportStatusForUser, BadgeVariant> = {
  new: "blue",
  investigating: "orange",
  fixed: "teal",
  ignored: "blue",
};

/** The signed-in user's problem reports and where each one stands. The admin note is never shown. */
export default async function MyReportsPage() {
  const { user } = await requireUser("/account/reports");
  const reports = await listOwnReports(user.id);
  return (
    <div className="shell section-y">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/account"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-teal underline-offset-4 hover:underline"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {copy.back}
        </Link>
        <Eyebrow className="mt-2">{copy.eyebrow}</Eyebrow>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-h2 text-ink">{copy.title}</h1>
            <p className="mt-2 text-body text-muted">{copy.intro}</p>
          </div>
          {reports.length > 0 && (
            <SiteModalButton modal="reportProblem" className={buttonClasses({ variant: "secondary", className: "shrink-0 max-sm:w-full" })}>
              {reportProblem.trigger}
            </SiteModalButton>
          )}
        </div>

        {reports.length === 0 ? (
          <EmptyState
            as="h2"
            className="mt-8"
            icon={<LifeBuoy aria-hidden />}
            title={copy.emptyTitle}
            description={copy.emptyBody}
            action={
              <SiteModalButton modal="reportProblem" className={buttonClasses({ variant: "secondary" })}>
                {reportProblem.trigger}
              </SiteModalButton>
            }
          />
        ) : (
          <>
            <ul className="mt-8 flex flex-col gap-3">
              {reports.map((report) => (
                <li
                  key={report.id}
                  data-testid="my-report"
                  className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-small font-bold text-muted">
                      {copy.sent(formatDate(report.createdAt))}
                      {report.status !== "new" && ` · ${copy.updated(formatDate(report.updatedAt))}`}
                    </p>
                    <Badge variant={statusVariant[report.status]}>
                      <span className="sr-only">{copy.statusLabel}: </span>
                      {reportStatusForUser[report.status]}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-4 text-sm break-words whitespace-pre-line text-ink">
                    {report.description}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-muted">
                    {report.pageUrl && (
                      <span className="min-w-0 break-all">
                        {copy.page}: <span className="font-mono">{pagePathOf(report.pageUrl)}</span>
                      </span>
                    )}
                    {report.hasScreenshot && (
                      <a
                        href={`/api/bug-reports/${report.id}/screenshot`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex min-h-11 items-center gap-1 font-bold text-teal underline-offset-4 hover:underline"
                      >
                        <ImageIcon aria-hidden className="size-4" />
                        {copy.viewScreenshot}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {reports.length >= ownReportsShown && (
              <p className="mt-4 text-small text-muted">{copy.shown(ownReportsShown)}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
