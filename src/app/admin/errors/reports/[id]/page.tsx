import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Unlink } from "lucide-react";
import { z } from "zod";
import { ErrorStatusBadge } from "@/components/admin/error-status-badge";
import { AdminPageHeader } from "@/components/admin/page-header";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { bugReportsAdmin as text } from "@/content/bug-reports";
import { errorLog, errorScreen } from "@/content/errors";
import { browserOf } from "@/lib/bug-report";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { formatIndianPhone } from "@/lib/phone";
import { adminNoteMax, getReport } from "@/server/admin/bug-reports";
import { errorStatuses } from "@/server/admin/errors";
import { requireAdmin } from "@/server/auth/session";
import { linkErrorAction, unlinkErrorAction, updateReportAction } from "../actions";

export const metadata: Metadata = { title: text.detail.metaTitle };

const d = text.detail;
const label = "mb-1.5 text-xs font-extrabold text-ink";

/** The visit's errors as the report stored them; anything unexpected shows as none. */
const storedSessionErrors = z
  .array(
    z.object({
      message: z.string(),
      url: z.string(),
      kind: z.string(),
      at: z.string(),
      digest: z.string().optional(),
    }),
  )
  .catch([]);

const notices = {
  saved: { tone: "success", message: d.saved },
  linked: { tone: "success", message: d.linkedNotice },
  already: { tone: "success", message: d.alreadyLinked },
  unlinked: { tone: "success", message: d.unlinkedNotice },
  "no-error": { tone: "error", message: d.noError },
  "bad-reference": { tone: "error", message: d.badReference },
} as const;

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-extrabold tracking-wide text-muted uppercase">{term}</dt>
      <dd className="mt-0.5 text-sm break-words text-ink">{children}</dd>
    </div>
  );
}

/** One problem report: what happened, who and where, the screenshot, errors from the visit, links, status and note. */
export default async function AdminBugReportPage({ params, searchParams }: PageProps<"/admin/errors/reports/[id]">) {
  const { id } = await params;
  await requireAdmin("errors", `/admin/errors/reports/${id}`);
  if (!/^\d{1,9}$/.test(id)) notFound();
  const report = await getReport(Number(id));
  if (!report) notFound();
  const done = (await searchParams).done;
  const notice = typeof done === "string" && done in notices ? notices[done as keyof typeof notices] : null;
  const sessionErrors = storedSessionErrors.parse(report.sessionErrors ?? []);
  const contact = report.user
    ? [report.user.phoneNumber ? formatIndianPhone(report.user.phoneNumber) : null, report.user.email]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <>
      <Link href="/admin/errors/reports" className={buttonClasses({ variant: "link", size: "sm", className: "mb-3" })}>
        <ArrowLeft aria-hidden className="size-4" />
        {text.back}
      </Link>
      <AdminPageHeader
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2">
            {text.tabs.reports}
            <ErrorStatusBadge status={report.status} />
          </span>
        }
        title={d.title(report.id)}
        description={formatDateTime(report.createdAt)}
      />
      {notice && (
        <FormAlert tone={notice.tone} className="mt-6">
          {notice.message}
        </FormAlert>
      )}

      <section aria-labelledby="report-description" className="mt-6 rounded-xl border border-line bg-surface p-4 shadow-card">
        <h2 id="report-description" className="text-h3 text-ink">
          {d.whatHappened}
        </h2>
        <p data-testid="report-description" className="mt-2 text-sm break-words whitespace-pre-line text-ink">
          {report.description}
        </p>
      </section>

      <dl className="mt-6 grid gap-4 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-3">
        <Fact term={d.received}>{formatDateTime(report.createdAt)}</Fact>
        <Fact term={d.from}>
          {report.user ? (
            <>
              <Link href={`/admin/users/${report.user.id}`} className="font-bold text-brand underline-offset-4 hover:underline">
                {report.user.name}
              </Link>
              {contact && <span className="block text-small text-muted">{contact}</span>}
            </>
          ) : (
            text.guest
          )}
        </Fact>
        {!report.user && (
          <Fact term={d.contact}>
            {report.contactEmail ? (
              <a href={`mailto:${report.contactEmail}`} className="font-bold text-brand underline-offset-4 hover:underline">
                {report.contactEmail}
              </a>
            ) : (
              d.noContact
            )}
          </Fact>
        )}
        <Fact term={d.page}>
          {report.pageUrl ? <span className="font-mono text-small break-all">{report.pageUrl}</span> : d.unknown}
        </Fact>
        <Fact term={d.device}>
          {browserOf(report.userAgent)}
          {report.device ? ` · ${report.device}` : ""}
          {report.userAgent && <span className="block text-small break-words text-muted">{report.userAgent}</span>}
        </Fact>
        <Fact term={d.screen}>
          {report.screenWidth && report.screenHeight
            ? d.screenValue(report.screenWidth, report.screenHeight, report.pixelRatio)
            : d.unknown}
        </Fact>
        <Fact term={d.window}>
          {report.viewportWidth && report.viewportHeight
            ? d.windowValue(report.viewportWidth, report.viewportHeight)
            : d.unknown}
        </Fact>
        <Fact term={d.version}>{report.appVersion ?? d.unknown}</Fact>
      </dl>

      <section aria-labelledby="report-status" className="mt-6 rounded-xl border border-line bg-surface p-4 shadow-card">
        <h2 id="report-status" className="text-h3 text-ink">
          {d.statusHeading}
        </h2>
        <p className="mt-1 text-small text-muted">{d.statusHelp}</p>
        <form action={updateReportAction} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="id" value={report.id} />
          <div className="flex flex-col sm:w-64">
            <label htmlFor="report-status-select" className={label}>
              {errorLog.statusFilter}
            </label>
            <select id="report-status-select" name="status" defaultValue={report.status} className={cn(inputClasses, "cursor-pointer")}>
              {errorStatuses.map((status) => (
                <option key={status} value={status}>
                  {errorLog.statuses[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label htmlFor="report-note" className={label}>
              {d.noteLabel}
            </label>
            <textarea
              id="report-note"
              name="adminNote"
              rows={3}
              maxLength={adminNoteMax}
              defaultValue={report.adminNote ?? ""}
              aria-describedby="report-note-help"
              className={cn(inputClasses, "h-auto min-h-24 resize-y py-3 leading-normal")}
            />
            <p id="report-note-help" className="mt-1.5 text-small text-muted">
              {d.noteHelp(adminNoteMax)}
            </p>
          </div>
          <Button type="submit" className="sm:self-start">
            {d.save}
          </Button>
        </form>
      </section>

      <section aria-labelledby="report-screenshot" className="mt-8">
        <h2 id="report-screenshot" className="text-h3 text-ink">
          {d.screenshot}
        </h2>
        {report.screenshotKey ? (
          <div className="mt-3">
            {/* A private file served by an access-checked route, so next/image's optimiser can't fetch it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/bug-reports/${report.id}/screenshot`}
              alt={d.screenshotAlt(report.id)}
              className="max-h-[480px] w-auto max-w-full rounded-lg border border-line bg-surface-alt object-contain"
            />
            <a
              href={`/api/bug-reports/${report.id}/screenshot`}
              target="_blank"
              rel="noopener"
              className={buttonClasses({ variant: "link", size: "sm", className: "mt-2" })}
            >
              <ExternalLink aria-hidden className="size-4" />
              {d.openScreenshot}
            </a>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">{d.noScreenshot}</p>
        )}
      </section>

      <section aria-labelledby="report-linked" className="mt-8">
        <h2 id="report-linked" className="text-h3 text-ink">
          {d.linked}
        </h2>
        <p className="mt-1 text-small text-muted">{d.linkedHelp}</p>
        {report.errors.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{d.noLinked}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {report.errors.map(({ group, auto }) => (
              <li key={group.id} data-testid="linked-error" className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/errors/${group.id}`} className="font-bold break-words text-ink hover:text-brand">
                    {d.errorLabel(group.id, group.message)}
                  </Link>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-small text-muted">
                    <Badge variant={group.source === "server" ? "blue" : "gold"}>{errorLog.sources[group.source]}</Badge>
                    <ErrorStatusBadge status={group.status} />
                    <span className="font-mono break-all">{group.route}</span>
                    <span>{d.times(group.count)}</span>
                    <span>{auto ? d.auto : d.manual}</span>
                  </span>
                </div>
                <form action={unlinkErrorAction}>
                  <input type="hidden" name="id" value={report.id} />
                  <input type="hidden" name="groupId" value={group.id} />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    aria-label={d.unlinkLabel(group.id)}
                    className="max-sm:w-full"
                  >
                    <Unlink aria-hidden className="size-4" />
                    {d.unlink}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={linkErrorAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="id" value={report.id} />
          <div className="flex flex-col sm:w-80">
            <label htmlFor="report-link-error" className={label}>
              {d.linkLabel}
            </label>
            <input
              id="report-link-error"
              name="error"
              required
              maxLength={300}
              placeholder={d.linkPlaceholder}
              aria-describedby="report-link-help"
              className={inputClasses}
            />
            <p id="report-link-help" className="mt-1.5 text-small text-muted">
              {d.linkHelp}
            </p>
          </div>
          <Button type="submit" variant="secondary" className="sm:mb-7">
            {d.link}
          </Button>
        </form>
      </section>

      <section aria-labelledby="report-session-errors" className="mt-8">
        <h2 id="report-session-errors" className="text-h3 text-ink">
          {d.sessionErrors}
        </h2>
        <p className="mt-1 text-small text-muted">{d.sessionErrorsHelp}</p>
        {sessionErrors.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{d.noSessionErrors}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {sessionErrors.map((entry, index) => (
              <li key={index} data-testid="session-error" className="flex flex-col gap-1 p-4 text-sm">
                <span className="font-mono font-bold break-words text-ink">{entry.message}</span>
                <span className="font-mono text-small break-all text-muted">{entry.url}</span>
                <span className="text-small text-muted">
                  {Number.isNaN(Date.parse(entry.at)) ? entry.at : formatDateTime(new Date(entry.at))} · {entry.kind}
                  {entry.digest ? ` · ${errorScreen.reference(entry.digest)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
