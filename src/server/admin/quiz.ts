import "server-only";
import { z } from "zod";
import { admin as copy } from "@/content/admin";
import { QUIZ_QUESTION_COUNT, parseIstLocal } from "@/lib/quiz";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { createdFields, diffFields, logAdminAction } from "./audit";
import { blankToNull, checkbox, optionalText } from "./form";

// Quiz authoring. The question builder sends its questions as one JSON field;
// saving replaces all of a quiz's questions and options. Attempts keep their
// answers by question id, so once anyone has played a quiz its questions are
// locked (the schedule, pass mark and title can still change).

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
    explanation: optionalText(400, errors.explanation),
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

/** A blank or India-time "2026-10-05T09:00" value as an instant (null: blank). */
const istField = z.preprocess(
  blankToNull,
  z
    .string({ error: errors.schedule })
    .transform((value, ctx) => {
      const at = parseIstLocal(value);
      if (!at) ctx.addIssue({ code: "custom", message: errors.schedule });
      return at ?? z.NEVER;
    })
    .nullable(),
);

export const quizInputSchema = z
  .object({
  title: z
    .string({ error: errors.title })
    .trim()
    .min(1, errors.title)
    .max(160, errors.title),
  description: optionalText(600, "Use up to 600 characters."),
  active: checkbox,
  startsAt: istField,
  endsAt: istField,
  passPercent: z.coerce
    .number({ error: errors.passPercent })
    .int(errors.passPercent)
    .min(1, errors.passPercent)
    .max(100, errors.passPercent),
  questions: questionsField,
})
  .superRefine((quiz, ctx) => {
    if ((quiz.startsAt === null) !== (quiz.endsAt === null)) {
      ctx.addIssue({ code: "custom", path: [quiz.startsAt ? "endsAt" : "startsAt"], message: errors.scheduleBoth });
    } else if (quiz.startsAt && quiz.endsAt) {
      if (quiz.endsAt <= quiz.startsAt) {
        ctx.addIssue({ code: "custom", path: ["endsAt"], message: errors.scheduleOrder });
      }
      if (quiz.questions.length !== QUIZ_QUESTION_COUNT) {
        ctx.addIssue({ code: "custom", path: ["questions"], message: errors.scheduledCount });
      }
    }
  });

export type QuizInput = z.infer<typeof quizInputSchema>;

export type QuizRow = {
  id: number;
  title: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  attempts: number;
  questionCount: number;
  totalPoints: number;
  updatedAt: Date;
};

export async function listQuizzes(): Promise<QuizRow[]> {
  const quizzes = await db.quiz.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { questions: { select: { points: true } }, _count: { select: { attempts: true } } },
  });
  return quizzes.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    active: quiz.active,
    startsAt: quiz.startsAt,
    endsAt: quiz.endsAt,
    attempts: quiz._count.attempts,
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
  startsAt: Date | null;
  endsAt: Date | null;
  passPercent: number;
  attempts: number;
  questions: QuestionInput[];
};

export function getQuiz(id: number): Promise<QuizDetail | null> {
  return getQuizWith(db, id);
}

async function getQuizWith(client: Pick<typeof db, "quiz">, id: number): Promise<QuizDetail | null> {
  const quiz = await client.quiz.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: { options: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
      },
      _count: { select: { attempts: true } },
    },
  });
  if (!quiz) return null;
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    active: quiz.active,
    startsAt: quiz.startsAt,
    endsAt: quiz.endsAt,
    passPercent: quiz.passPercent,
    attempts: quiz._count.attempts,
    questions: quiz.questions.map((question) => ({
      prompt: question.prompt,
      points: question.points,
      explanation: question.explanation,
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
    explanation: question.explanation,
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
    startsAt: input.startsAt?.toISOString() ?? null,
    endsAt: input.endsAt?.toISOString() ?? null,
    passPercent: input.passPercent,
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
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        passPercent: input.passPercent,
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

/** Questions as comparable text, whatever order their keys came in. */
const canonical = (questions: QuestionInput[]) =>
  JSON.stringify(
    questions.map((q) => [q.prompt, q.points, q.options, q.correct, q.explanation ?? null]),
  );

/**
 * True when saved; false when the quiz no longer exists; "locked" when the
 * questions would change but the quiz already has attempts.
 */
export async function updateQuiz(
  id: number,
  input: QuizInput,
  actorId: string,
): Promise<boolean | "locked"> {
  return db.$transaction(async (tx) => {
    // Attempts are created under no lock on the quiz, so serialise on its row.
    await tx.$queryRaw`SELECT id FROM Quiz WHERE id = ${id} FOR UPDATE`;
    const before = await getQuizWith(tx, id);
    if (!before) return false;
    const questionsChanged = canonical(before.questions) !== canonical(input.questions);
    if (questionsChanged && before.attempts > 0) return "locked" as const;
    const changes = diffFields(auditView(before), auditView(input));
    // Record that the questions changed, without copying them into the log.
    if (questionsChanged) changes.questionsEdited = { from: false, to: true };
    if (Object.keys(changes).length === 0) return true;
    if (questionsChanged) await tx.quizQuestion.deleteMany({ where: { quizId: id } });
    await tx.quiz.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        active: input.active,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        passPercent: input.passPercent,
        ...(questionsChanged ? { questions: { create: questionCreates(input.questions) } } : {}),
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

/**
 * False when the quiz no longer exists; "locked" when someone has played it
 * (deleting would take their attempts and leaderboard places with it, so it
 * can only be unpublished).
 */
export async function deleteQuiz(id: number, actorId: string): Promise<boolean | "locked"> {
  return db.$transaction(async (tx) => {
    // The same row lock as updateQuiz, so a start can't slip in between.
    await tx.$queryRaw`SELECT id FROM Quiz WHERE id = ${id} FOR UPDATE`;
    const quiz = await tx.quiz.findUnique({
      where: { id },
      select: { title: true, _count: { select: { attempts: true } } },
    });
    if (!quiz) return false;
    if (quiz._count.attempts > 0) return "locked" as const;
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
