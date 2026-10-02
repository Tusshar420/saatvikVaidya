import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { VerificationBadge } from "@/components/admin/badges";
import { DecisionForm } from "@/components/admin/decision-form";
import { DocumentReview } from "@/components/admin/document-review";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { admin as copy } from "@/content/admin";
import { verification } from "@/content/verification";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatIndianPhone } from "@/lib/phone";
import { isDocumentType } from "@/lib/verification";
import { requireAdmin } from "@/server/auth/session";
import { readVerificationReview } from "@/server/verification/documents";

export const metadata: Metadata = { title: copy.review.metaTitle };

const text = copy.review;

/**
 * One professional's verification: their documents with previews, the
 * approve/reject form, and every earlier decision. Users whose type needs no
 * verification (or who don't exist) get a 404.
 */
export default async function ReviewPage({
  params,
}: PageProps<"/admin/approvals/detail/[userId]">) {
  await requireAdmin("approvals");
  const { userId } = await params;
  const review = await readVerificationReview(userId);
  if (!review) notFound();

  const byType = new Map(review.documents.map((doc) => [doc.documentType, doc]));
  const required: readonly string[] = review.required;
  // Files of a type no longer required (for example after a type change).
  const others = review.documents.filter(
    (doc) => !required.includes(doc.documentType),
  );

  return (
    <>
      <Link
        href="/admin/approvals"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-teal hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {text.back}
      </Link>
      <AdminPageHeader
        className="mt-2"
        eyebrow={text.eyebrow}
        title={review.name}
        description={review.userTypeLabel}
        action={
          <Link
            href={`/admin/users/${review.userId}`}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            {text.fullProfile}
          </Link>
        }
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card as="section" aria-labelledby="review-documents">
          <h2 id="review-documents" className="text-h3 text-ink">
            {text.documentsTitle}
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            {review.required.map((type) => (
              <DocumentReview
                key={type}
                label={verification.documentTypes[type].label}
                help={verification.documentTypes[type].help}
                document={byType.get(type) ?? null}
              />
            ))}
            {others.map((doc) => (
              <DocumentReview
                key={doc.id}
                label={
                  isDocumentType(doc.documentType)
                    ? verification.documentTypes[doc.documentType].label
                    : text.otherDocument
                }
                document={doc}
              />
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-5">
          <Card as="section" aria-labelledby="review-applicant">
            <h2 id="review-applicant" className="text-h3 text-ink">
              {text.applicantTitle}
            </h2>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              <Row label={text.fields.status}>
                <VerificationBadge status={review.status} />
              </Row>
              <Row label={text.fields.submitted}>
                {review.submittedAt ? (
                  formatDateTime(review.submittedAt)
                ) : (
                  <span className="text-muted">{text.notSubmitted}</span>
                )}
              </Row>
              <Row label={text.fields.type}>{review.userTypeLabel}</Row>
              <Row label={text.fields.email}>
                {review.email ? (
                  <span className="break-all">{review.email}</span>
                ) : (
                  <span className="text-muted">{copy.users.noEmail}</span>
                )}
              </Row>
              <Row label={text.fields.phone}>
                {review.phoneNumber ? (
                  formatIndianPhone(review.phoneNumber)
                ) : (
                  <span className="text-muted">{copy.users.noPhone}</span>
                )}
              </Row>
              <Row label={text.fields.joined}>{formatDate(review.createdAt)}</Row>
            </dl>
          </Card>

          <Card as="section" aria-labelledby="review-decision">
            <h2 id="review-decision" className="text-h3 text-ink">
              {text.decisionTitle}
            </h2>
            <DecisionForm
              userId={review.userId}
              name={review.name}
              className="mt-4"
            />
          </Card>

          <Card as="section" aria-labelledby="review-history">
            <h2 id="review-history" className="text-h3 text-ink">
              {text.historyTitle}
            </h2>
            {review.history.length === 0 ? (
              <p className="mt-4 text-sm text-muted">{text.historyEmpty}</p>
            ) : (
              <ol className="mt-4 flex flex-col gap-4">
                {review.history.map((item) => (
                  <li key={item.id} className="flex flex-col gap-1 text-sm">
                    <Badge variant={item.decision === "approved" ? "teal" : "orange"}>
                      {text.decisions[item.decision]}
                    </Badge>
                    <p className="text-ink break-words">
                      {item.comment ?? (
                        <span className="text-muted">{text.noComment}</span>
                      )}
                    </p>
                    <p className="text-small text-muted">
                      {formatDateTime(item.createdAt)} ·{" "}
                      {text.by(item.authorName ?? text.deletedAdmin)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-small font-bold text-muted">{label}</dt>
      <dd className="font-semibold break-words text-ink">{children}</dd>
    </div>
  );
}
