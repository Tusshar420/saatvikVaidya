import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { VerificationBadge } from "@/components/admin/badges";
import {
  DataTable,
  EmptyRow,
  TBody,
  THead,
  Td,
  Th,
  Tr,
} from "@/components/admin/data-table";
import { DecisionForm } from "@/components/admin/decision-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { admin as copy } from "@/content/admin";
import { formatDate } from "@/lib/format";
import { listPendingApprovals } from "@/server/admin/users";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.approvals.metaTitle };

const text = copy.approvals;

/** Professional accounts waiting for verification, oldest first. */
export default async function ApprovalsPage() {
  await requireAdmin();
  const pending = await listPendingApprovals();

  return (
    <>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
      />
      <DataTable caption={text.title} className="mt-6">
        <THead>
          <Th>{text.columns.name}</Th>
          <Th>{text.columns.type}</Th>
          <Th>
            {text.columns.submitted}
            <span className="sr-only"> ({text.submittedHelp})</span>
          </Th>
          <Th>{text.columns.status}</Th>
          <Th>{text.documents}</Th>
          <Th>{text.columns.decision}</Th>
        </THead>
        <TBody>
          {pending.length === 0 && <EmptyRow colSpan={6}>{text.empty}</EmptyRow>}
          {pending.map((user) => (
            <Tr key={user.id}>
              <Td>
                <Link
                  href={`/admin/users/${user.id}`}
                  aria-label={text.viewNamed(user.name)}
                  className="font-bold break-words text-teal hover:underline"
                >
                  {user.name}
                </Link>
              </Td>
              <Td label={text.columns.type}>{user.userTypeLabel}</Td>
              <Td label={text.columns.submitted} className="whitespace-nowrap">
                {formatDate(user.createdAt)}
              </Td>
              <Td label={text.columns.status}>
                <VerificationBadge status={user.verificationStatus} />
              </Td>
              <Td label={text.documents}>
                <span className="inline-flex items-center gap-1.5">
                  <FileText aria-hidden className="size-4 text-muted" />
                  <Badge variant="soon">{text.documentsSoon}</Badge>
                </span>
              </Td>
              <Td className="max-md:mt-2 md:min-w-72">
                <DecisionForm userId={user.id} name={user.name} compact />
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
    </>
  );
}
