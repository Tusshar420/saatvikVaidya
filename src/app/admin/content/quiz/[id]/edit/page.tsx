import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { QuizBuilder } from "@/components/admin/quiz-builder";
import { admin as copy } from "@/content/admin";
import { formatIstLocal } from "@/lib/quiz";
import { intId } from "@/server/admin/form";
import { getQuiz } from "@/server/admin/quiz";
import { requireAdmin } from "@/server/auth/session";
import { updateQuizAction } from "../../../actions";

export const metadata: Metadata = { title: copy.quiz.metaTitle };

export default async function EditQuizPage({
  params,
}: PageProps<"/admin/content/quiz/[id]/edit">) {
  await requireAdmin("content");
  const id = intId.safeParse((await params).id);
  const quiz = id.success ? await getQuiz(id.data) : null;
  if (!quiz) notFound();
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.quiz.eyebrow}
        title={copy.quiz.editTitle(quiz.title)}
      />
      <QuizBuilder
        mode="edit"
        action={updateQuizAction.bind(null, quiz.id)}
        initial={{
          title: quiz.title,
          description: quiz.description,
          active: quiz.active,
          startsAt: quiz.startsAt ? formatIstLocal(quiz.startsAt) : "",
          endsAt: quiz.endsAt ? formatIstLocal(quiz.endsAt) : "",
          passPercent: quiz.passPercent,
        }}
        initialQuestions={quiz.questions.map((question) => ({ ...question, explanation: question.explanation ?? "" }))}
        lockedAttempts={quiz.attempts}
      />
    </>
  );
}
