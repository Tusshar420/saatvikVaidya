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
import { FormAlert } from "@/components/site/auth/form-alert";
import { buttonClasses } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { admin as copy } from "@/content/admin";
import { listQuizzes } from "@/server/admin/quiz";
import { requireAdmin } from "@/server/auth/session";
import { deleteQuizAction } from "../actions";

export const metadata: Metadata = { title: copy.quiz.metaTitle };

const text = copy.quiz;

function windowLabel(quiz: { startsAt: Date | null; endsAt: Date | null }, now: Date): string {
  if (!quiz.startsAt || !quiz.endsAt) return text.ready;
  if (now < quiz.startsAt) return text.upcoming;
  return now < quiz.endsAt ? text.live : text.ended;
}

export default async function QuizListPage({
  searchParams,
}: PageProps<"/admin/content/quiz">) {
  await requireAdmin("content");
  const [quizzes, params] = await Promise.all([listQuizzes(), searchParams]);
  const now = new Date();

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
      {params.error === "played" && (
        <FormAlert className="mt-6">{text.deletePlayed}</FormAlert>
      )}
      <DataTable caption={text.title} className="mt-6">
        <THead>
          <Th>{text.columns.title}</Th>
          <Th>{text.columns.questions}</Th>
          <Th>{text.columns.points}</Th>
          <Th>{text.columns.schedule}</Th>
          <Th>{text.columns.attempts}</Th>
          <Th>{text.columns.status}</Th>
          <Th>
            <span className="sr-only">{text.columns.actions}</span>
          </Th>
        </THead>
        <TBody>
          {quizzes.length === 0 && (
            <EmptyRow colSpan={7}>{text.empty}</EmptyRow>
          )}
          {quizzes.map((quiz) => (
            <Tr key={quiz.id}>
              <Td className="font-bold break-words text-ink">{quiz.title}</Td>
              <Td label={text.columns.questions}>{quiz.questionCount}</Td>
              <Td label={text.columns.points}>{quiz.totalPoints}</Td>
              <Td label={text.columns.schedule}>
                {quiz.startsAt && quiz.endsAt
                  ? `${formatDateTime(quiz.startsAt)} – ${formatDateTime(quiz.endsAt)}`
                  : text.notScheduled}
              </Td>
              <Td label={text.columns.attempts}>{quiz.attempts}</Td>
              <Td label={text.columns.status}>
                <ActiveBadge
                  active={quiz.active}
                  activeLabel={windowLabel(quiz, now)}
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
