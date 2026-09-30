import "server-only";
import { z } from "zod";
import { admin as copy } from "@/content/admin";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { createdFields, diffFields, logAdminAction } from "./audit";
import { checkbox, optionalText } from "./form";

// Quiz authoring. The question builder sends its questions as one JSON field;
// saving replaces all of a quiz's questions and options. Nothing refers to
// them yet (attempts arrive with Quiz & Win in Phase 2), so that's safe.

const errors = copy.quiz.errors;

export const MAX_QUESTIONS = 50;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

export const questionSchema = z
  .object({
    prompt: z
      .string({ error: errors.prompt })
      .trim()
      .min(1, errors.prompt)
      .max(400, errors.prompt),
    points: z.coerce
      .number({ error: errors.points })
      .int(errors.points)
      .min(0, errors.points)
      .max(1000, errors.points),
    options: z
      .array(
        z
          .string({ error: errors.options })
          .trim()
          .min(1, errors.options)
          .max(200, errors.options),
        { error: errors.options },
      )
      .min(MIN_OPTIONS, errors.options)
      .max(MAX_OPTIONS, errors.options),
    correct: z.number({ error: errors.correct }).int(errors.correct).min(0),
  })
  .refine((question) => question.correct < question.options.length, {
    path: ["correct"],
    message: errors.correct,
  });

export type QuestionInput = z.infer<typeof questionSchema>;

/** The questions field: JSON text from the builder. */
const questionsField = z
  .string({ error: errors.questions })
  .max(200_000, errors.questions)
  .transform((text, ctx) => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: errors.questions });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(questionSchema, { error: errors.questions })
      .min(1, errors.questions)
      .max(MAX_QUESTIONS, errors.questions),
  );

export const quizInputSchema = z.object({
  title: z
    .string({ error: errors.title })
    .trim()
    .min(1, errors.title)
    .max(160, errors.title),
  description: optionalText(600, "Use up to 600 characters."),
  active: checkbox,
  questions: questionsField,
});

export type QuizInput = z.infer<typeof quizInputSchema>;

export type QuizRow = {
  id: number;
  title: string;
  active: boolean;
  questionCount: number;
  totalPoints: number;
  updatedAt: Date;
};

export async function listQuizzes(): Promise<QuizRow[]> {
  const quizzes = await db.quiz.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { questions: { select: { points: true } } },
  });
  return quizzes.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    active: quiz.active,
    questionCount: quiz.questions.length,
    totalPoints: quiz.questions.reduce((sum, q) => sum + q.points, 0),
    updatedAt: quiz.updatedAt,
  }));
}

export type QuizDetail = {
  id: number;
  title: string;
  description: string | null;
  active: boolean;
  questions: QuestionInput[];
};

export async function getQuiz(id: number): Promise<QuizDetail | null> {
  const quiz = await db.quiz.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: { options: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
      },
    },
  });
  if (!quiz) return null;
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    active: quiz.active,
    questions: quiz.questions.map((question) => ({
      prompt: question.prompt,
      points: question.points,
      options: question.options.map((option) => option.text),
      correct: Math.max(
        0,
        question.options.findIndex((option) => option.isCorrect),
      ),
    })),
  };
}

function questionCreates(
  questions: QuestionInput[],
): Prisma.QuizQuestionCreateWithoutQuizInput[] {
  return questions.map((question, index) => ({
    sortOrder: (index + 1) * 10,
    prompt: question.prompt,
    points: question.points,
    options: {
      create: question.options.map((text, optionIndex) => ({
        sortOrder: (optionIndex + 1) * 10,
        text,
        isCorrect: optionIndex === question.correct,
      })),
    },
  }));
}

/** What the audit log records about a quiz (not every question's text). */
function auditView(input: QuizInput | QuizDetail) {
  return {
    title: input.title,
    description: input.description,
    active: input.active,
    questions: input.questions.length,
    totalPoints: input.questions.reduce((sum, q) => sum + q.points, 0),
  };
}

export async function createQuiz(
  input: QuizInput,
  actorId: string,
): Promise<number> {
  return db.$transaction(async (tx) => {
    const quiz = await tx.quiz.create({
      data: {
        title: input.title,
        description: input.description,
        active: input.active,
        questions: { create: questionCreates(input.questions) },
      },
    });
    await logAdminAction(tx, {
      actorId,
      action: "quiz.create",
      resource: "Quiz",
      resourceId: quiz.id,
      changes: createdFields(auditView(input)),
    });
    return quiz.id;
  });
}

/** False when the quiz no longer exists. */
export async function updateQuiz(
  id: number,
  input: QuizInput,
  actorId: string,
): Promise<boolean> {
  const before = await getQuiz(id);
  if (!before) return false;
  return db.$transaction(async (tx) => {
    const changes = diffFields(auditView(before), auditView(input));
    // Record that the questions changed, without copying them into the log.
    if (JSON.stringify(before.questions) !== JSON.stringify(input.questions)) {
      changes.questionsEdited = { from: false, to: true };
    }
    if (Object.keys(changes).length === 0) return true;
    await tx.quizQuestion.deleteMany({ where: { quizId: id } });
    await tx.quiz.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        active: input.active,
        questions: { create: questionCreates(input.questions) },
      },
    });
    await logAdminAction(tx, {
      actorId,
      action: "quiz.update",
      resource: "Quiz",
      resourceId: id,
      changes,
    });
    return true;
  });
}

/** False when the quiz no longer exists. */
export async function deleteQuiz(id: number, actorId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const quiz = await tx.quiz.findUnique({
      where: { id },
      select: { title: true },
    });
    if (!quiz) return false;
    // Questions and options go with it (onDelete: Cascade).
    await tx.quiz.delete({ where: { id } });
    await logAdminAction(tx, {
      actorId,
      action: "quiz.delete",
      resource: "Quiz",
      resourceId: id,
      changes: createdFields({ title: quiz.title }),
    });
    return true;
  });
}
