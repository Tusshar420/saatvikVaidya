import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ErrorStatusBadge } from "@/components/admin/error-status-badge";
import { AdminPageHeader } from "@/components/admin/page-header";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { bugReportsAdmin } from "@/content/bug-reports";
import { errorLog as text } from "@/content/errors";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { reportsForError } from "@/server/admin/bug-reports";
import { errorStatuses, getError } from "@/server/admin/errors";
import { requireAdmin } from "@/server/auth/session";
import { occurrencesKept, retentionDays } from "@/server/errors/record";
import { setErrorStatusAction } from "../actions";

export const metadata: Metadata = { title: text.detail.metaTitle };

const d = text.detail;

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-extrabold tracking-wide text-muted uppercase">{term}</dt>
      <dd className="mt-0.5 text-sm break-words text-ink">{children}</dd>
    </div>
  );
}

/** One error: facts, status control, stack trace, affected users and latest occurrences. */
export default async function AdminErrorDetailPage({
  params,
  searchParams,
}: PageProps<"/admin/errors/[id]">) {
  const { id } = await params;
  await requireAdmin("errors", `/admin/errors/${id}`);
  if (!/^\d{1,9}$/.test(id)) notFound();
  const found = await getError(Number(id));
  if (!found) notFound();
  const { group, affectedUsers } = found;
  const reports = await reportsForError(group.id);
  const saved = (await searchParams).saved === "1";

  return (
    <>
      <Link href="/admin/errors" className={buttonClasses({ variant: "link", size: "sm", className: "mb-3" })}>
        <ArrowLeft aria-hidden className="size-4" />
        {text.back}
      </Link>
      <AdminPageHeader
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2">
            {text.sources[group.source]}
            <ErrorStatusBadge status={group.status} />
          </span>
        }
        title={<span className="font-mono text-xl sm:text-2xl">{group.message}</span>}
        description={text.happened(group.count)}
      />
      {saved && (
        <FormAlert tone="success" className="mt-6">
          {d.saved}
        </FormAlert>
      )}

      <section aria-labelledby="error-status" className="mt-6 rounded-xl border border-line bg-surface p-4 shadow-card">
        <h2 id="error-status" className="text-h3 text-ink">
          {d.statusHeading}
        </h2>
        <p className="mt-1 text-small text-muted">{d.statusHelp}</p>
        <form action={setErrorStatusAction} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="id" value={group.id} />
          <div className="flex flex-col sm:w-64">
            <label htmlFor="error-status-select" className="mb-1.5 text-xs font-extrabold text-ink">
              {text.statusFilter}
            </label>
            <select id="error-status-select" name="status" defaultValue={group.status} className={cn(inputClasses, "cursor-pointer")}>
              {errorStatuses.map((status) => (
                <option key={status} value={status}>
                  {text.statuses[status]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">{d.save}</Button>
        </form>
      </section>

      <dl className="mt-6 grid gap-4 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-3">
        <Fact term={d.route}>
          <span className="font-mono">
            {group.method ? `${group.method} ` : ""}
            {group.route}
            {group.statusCode ? ` · ${group.statusCode}` : ""}
          </span>
        </Fact>
        <Fact term={d.times}>{group.count.toLocaleString("en-IN")}</Fact>
        <Fact term={d.version}>{group.appVersion ?? "—"}</Fact>
        <Fact term={d.firstSeen}>{formatDateTime(group.firstSeenAt)}</Fact>
        <Fact term={d.lastSeen}>{formatDateTime(group.lastSeenAt)}</Fact>
        <Fact term={d.users}>
          {affectedUsers.length === 0 ? (
            d.usersNone
          ) : (
            <>
              <span className="font-bold">{d.usersCount(affectedUsers.length)}</span>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {affectedUsers.map((user) => (
                  <li key={user.id}>
                    <Badge variant="brand" className="normal-case">
                      {user.name}
                    </Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Fact>
      </dl>

      <section aria-labelledby="error-reports" className="mt-8">
        <h2 id="error-reports" className="text-h3 text-ink">
          {bugReportsAdmin.forError.heading}
        </h2>
        <p className="mt-1 text-small text-muted">{bugReportsAdmin.forError.help}</p>
        {reports.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{bugReportsAdmin.forError.none}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {reports.map((report) => (
              <li key={report.id} data-testid="error-report" className="flex flex-col gap-1 p-4 text-sm">
                <Link
                  href={`/admin/errors/reports/${report.id}`}
                  className="line-clamp-2 font-bold break-words text-ink hover:text-brand"
                >
                  {report.description}
                </Link>
                <span className="flex flex-wrap items-center gap-2 text-small text-muted">
                  <ErrorStatusBadge status={report.status} />
                  {report.user ? report.user.name : bugReportsAdmin.guest}
                  {" · "}
                  {formatDateTime(report.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="error-stack" className="mt-8">
        <h2 id="error-stack" className="text-h3 text-ink">
          {d.stack}
        </h2>
        {group.stack ? (
          <pre className="mt-3 max-h-96 overflow-auto rounded-lg border border-line bg-surface-alt p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink">
            {group.stack}
          </pre>
        ) : (
          <p className="mt-2 text-sm text-muted">{d.noStack}</p>
        )}
      </section>

      <section aria-labelledby="error-occurrences" className="mt-8">
        <h2 id="error-occurrences" className="text-h3 text-ink">
          {d.occurrences}
        </h2>
        <p className="mt-1 text-small text-muted">{d.occurrencesNote(occurrencesKept, retentionDays)}</p>
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
          {group.occurrences.map((occurrence) => (
            <li key={occurrence.id} data-testid="occurrence" className="flex flex-col gap-1 p-4 text-sm">
              <span className="font-bold text-ink">{formatDateTime(occurrence.createdAt)}</span>
              {occurrence.url && <span className="font-mono text-small break-all text-muted">{occurrence.url}</span>}
              <span className="text-small text-muted">
                {occurrence.user ? occurrence.user.name : d.guest}
                {occurrence.device ? ` · ${occurrence.device}` : ""}
                {occurrence.appVersion ? ` · ${occurrence.appVersion}` : ""}
              </span>
              {occurrence.userAgent && <span className="text-small break-words text-muted">{occurrence.userAgent}</span>}
              {occurrence.context != null && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-small font-bold text-brand">{d.context}</summary>
                  <pre className="mt-1 overflow-auto rounded-md bg-surface-alt p-2 font-mono text-xs whitespace-pre-wrap">
                    {JSON.stringify(occurrence.context, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
