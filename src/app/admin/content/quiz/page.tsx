import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ActiveBadge } from "@/components/admin/badges";
import {
  DataTable,
  EmptyRow,
  TBody,
  THead,
  Td,
  Th,
  Tr,
} from "@/components/admin/data-table";
import { Notice, parseNotice } from "@/components/admin/notice";
import { AdminPageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { buttonClasses } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";
import { listQuizzes } from "@/server/admin/quiz";
import { requireAdmin } from "@/server/auth/session";
import { deleteQuizAction } from "../actions";

export const metadata: Metadata = { title: copy.quiz.metaTitle };

const text = copy.quiz;

export default async function QuizListPage({
  searchParams,
}: PageProps<"/admin/content/quiz">) {
  await requireAdmin("content");
  const [quizzes, params] = await Promise.all([listQuizzes(), searchParams]);

  return (
    <>
      <AdminPageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
        action={
          <Link href="/admin/content/quiz/new" className={buttonClasses()}>
            <Plus aria-hidden className="size-4.5" />
            {text.add}
          </Link>
        }
      />
      <Notice notice={parseNotice(params.notice)} />
      <DataTable caption={text.title} className="mt-6">
        <THead>
          <Th>{text.columns.title}</Th>
          <Th>{text.columns.questions}</Th>
          <Th>{text.columns.points}</Th>
          <Th>{text.columns.status}</Th>
          <Th>
            <span className="sr-only">{text.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {quizzes.length === 0 && (
            <EmptyRow colSpan={5}>{text.empty}</EmptyRow>
          )}
          {quizzes.map((quiz) => (
            <Tr key={quiz.id}>
              <Td className="font-bold break-words text-ink">{quiz.title}</Td>
              <Td label={text.columns.questions}>{quiz.questionCount}</Td>
              <Td label={text.columns.points}>{quiz.totalPoints}</Td>
              <Td label={text.columns.status}>
                <ActiveBadge
                  active={quiz.active}
                  activeLabel={text.ready}
                  hiddenLabel={text.draft}
                />
              </Td>
              <Td>
                <RowActions
                  editHref={`/admin/content/quiz/${quiz.id}/edit`}
                  deleteAction={deleteQuizAction}
                  id={quiz.id}
                  name={quiz.title}
                />
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
    </>
  );
}
