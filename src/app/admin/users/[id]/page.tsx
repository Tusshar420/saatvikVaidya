import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, Pencil } from "lucide-react";
import { ActivityList } from "@/components/admin/activity-list";
import { VerificationBadge } from "@/components/admin/badges";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { DecisionForm } from "@/components/admin/decision-form";
import { Notice, parseNotice } from "@/components/admin/notice";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { admin as copy } from "@/content/admin";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatIndianPhone } from "@/lib/phone";
import { getUserDetail } from "@/server/admin/users";
import { requireAdmin } from "@/server/auth/session";
import { readProfessionalVerification } from "@/server/verification/documents";
import { deleteUserAction } from "../actions";

export const metadata: Metadata = { title: copy.userDetail.metaTitle };

const text = copy.userDetail;

export default async function UserDetailPage({
  params,
  searchParams,
}: PageProps<"/admin/users/[id]">) {
  const session = await requireAdmin();
  const { id } = await params;
  const [user, verification] = await Promise.all([
    getUserDetail(id),
    readProfessionalVerification(id),
  ]);
  if (!user) notFound();
  const isSelf = user.id === session.user.id;

  const signIn = [
    user.hasPassword ? text.signInMethods.password : null,
    user.phoneNumber ? text.signInMethods.otp : null,
  ].filter(Boolean);

  return (
    <>
      <Link
        href="/admin/users"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-teal hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {text.back}
      </Link>
      <AdminPageHeader
        className="mt-2"
        eyebrow={text.eyebrow}
        title={user.name}
        description={user.userTypeLabel}
        action={
          <div className="flex flex-wrap gap-2 max-sm:*:flex-1">
            <Link
              href={`/admin/users/${user.id}/edit`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              <Pencil aria-hidden className="size-4" />
              {text.edit}
            </Link>
            {!isSelf && (
              <ConfirmDelete
                action={deleteUserAction}
                id={user.id}
                name={user.name}
              />
            )}
          </div>
        }
      />
      <Notice notice={parseNotice((await searchParams).notice)} />

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card as="section" aria-labelledby="user-details">
          <h2 id="user-details" className="text-h3 text-ink">
            {text.detailsTitle}
          </h2>
          <dl className="mt-4 grid gap-3.5 text-sm sm:grid-cols-2">
            <Row label={text.fields.email}>
              {user.email ? (
                <>
                  <span className="break-all">{user.email}</span>{" "}
                  <Verified yes={user.emailVerified} />
                </>
              ) : (
                <span className="text-muted">{copy.users.noEmail}</span>
              )}
            </Row>
            <Row label={text.fields.phone}>
              {user.phoneNumber ? (
                <>
                  {formatIndianPhone(user.phoneNumber)}{" "}
                  <Verified yes={user.phoneNumberVerified} />
                </>
              ) : (
                <span className="text-muted">{copy.users.noPhone}</span>
              )}
            </Row>
            <Row label={text.fields.type}>{user.userTypeLabel}</Row>
            <Row label={text.fields.role}>
              {user.role === "admin" ? (
                <Badge variant="blue">{copy.users.roles.admin}</Badge>
              ) : (
                copy.users.roles.user
              )}
            </Row>
            <Row label={text.fields.signIn}>
              {signIn.length ? signIn.join(", ") : text.signInMethods.none}
            </Row>
            <Row label={text.fields.marketing}>
              {user.marketingOptIn ? copy.common.yes : copy.common.no}
            </Row>
            <Row label={text.fields.joined}>{formatDate(user.createdAt)}</Row>
            <Row label={text.fields.terms}>
              {formatDateTime(user.termsAcceptedAt)}
            </Row>
          </dl>
        </Card>

        <Card as="section" aria-labelledby="user-verification">
          <h2 id="user-verification" className="text-h3 text-ink">
            {text.verificationTitle}
          </h2>
          <div className="mt-4">
            <VerificationBadge status={user.verificationStatus} />
          </div>
          {user.requiresVerification ? (
            <>
              <div className="mt-4 flex flex-col gap-3 rounded-lg bg-surface-alt p-4 sm:flex-row sm:items-center">
                <p className="flex flex-1 items-start gap-2 text-sm text-ink">
                  <FileText aria-hidden className="mt-0.5 size-4.5 shrink-0 text-teal" />
                  <span>
                    <span className="block font-bold">{text.documentsTitle}</span>
                    {verification &&
                      text.documentsSummary(
                        verification.required.length -
                          verification.missing.length,
                        verification.required.length,
                      )}
                  </span>
                </p>
                <Link
                  href={`/admin/approvals/detail/${user.id}`}
                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                >
                  {text.reviewDocuments}
                </Link>
              </div>
              <DecisionForm
                userId={user.id}
                name={user.name}
                className="mt-5"
              />
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">{text.notProfessional}</p>
          )}
        </Card>
      </div>

      <Card as="section" aria-labelledby="user-history" className="mt-5">
        <h2 id="user-history" className="text-h3 text-ink">
          {text.historyTitle}
        </h2>
        <ActivityList items={user.history} empty={text.historyEmpty} />
      </Card>
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

function Verified({ yes }: { yes: boolean }) {
  return (
    <span className="text-small font-medium text-muted">
      ({yes ? text.verified : text.notVerified})
    </span>
  );
}
