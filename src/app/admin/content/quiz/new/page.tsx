import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { QuizBuilder } from "@/components/admin/quiz-builder";
import { admin as copy } from "@/content/admin";
import { requireAdmin } from "@/server/auth/session";
import { createQuizAction } from "../../actions";

export const metadata: Metadata = { title: copy.quiz.newTitle };

export default async function NewQuizPage() {
  await requireAdmin("content");
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.quiz.eyebrow}
        title={copy.quiz.newTitle}
        description={copy.quiz.description}
      />
      <QuizBuilder
        mode="new"
        action={createQuizAction}
        initial={{ active: false, passPercent: 60 }}
        initialQuestions={[]}
      />
    </>
  );
}
