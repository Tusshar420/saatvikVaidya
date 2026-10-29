import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import {
  QUIZ_QUESTION_COUNT,
  QUIZ_SECONDS,
  deadlineOf,
  qualifies,
  scoreAnswers,
  secondsTaken,
} from "@/lib/quiz";
import { creditQuizReward, ledgerTransaction, lockUser } from "@/server/coins/ledger";
import { getSetting } from "@/server/content/settings";
import { db } from "@/server/db";

// Playing a quiz (docs/CHUNKS.md, P2.3). The server owns the clock: an attempt
// starts when the server creates it, the answers are saved one at a time as
// they are chosen (so a refresh resumes), and an answer that arrives after the
// deadline is refused. Questions are read here without `isCorrect`; only
// `closeAttempt` reads it, to score. An attempt is unique per (user, quiz).

type Client = Prisma.TransactionClient;

function isUniqueClash(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "P2002"
  );
}

const answersSchema = z.record(z.string(), z.number().int());
export type Answers = z.infer<typeof answersSchema>;

export function readAnswers(value: unknown): Answers {
  const parsed = answersSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

/** The quiz that can be played at `now`: active, scheduled, inside its week, with all its questions. */
export async function findOpenQuiz(now: Date) {
  const quiz = await db.quiz.findFirst({
    where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      passPercent: true,
      _count: { select: { questions: true } },
    },
  });
  return quiz && quiz._count.questions === QUIZ_QUESTION_COUNT ? quiz : null;
}

/** The next quiz that is scheduled to open after `now`. */
export async function findNextQuiz(now: Date) {
  return db.quiz.findFirst({
    where: { active: true, startsAt: { gt: now } },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    select: { id: true, title: true, startsAt: true },
  });
}

export type StartResult = { ok: true; attemptId: number } | { ok: false; error: "closed" };

/** Starts the user's attempt on the open quiz. Starting again returns the same attempt. */
export async function startAttempt(userId: string, quizId: number, now = new Date()): Promise<StartResult> {
  const open = await findOpenQuiz(now);
  if (!open || open.id !== quizId) return { ok: false, error: "closed" };
  try {
    const attempt = await db.$transaction(async (tx) => {
      // A shared lock on the quiz: starts run side by side, but an admin's
      // question edit (which takes the row for update) waits for them.
      await tx.$queryRaw`SELECT id FROM Quiz WHERE id = ${quizId} LOCK IN SHARE MODE`;
      return tx.quizAttempt.create({
        data: { userId, quizId, startedAt: now, answers: {} },
        select: { id: true },
      });
    });
    return { ok: true, attemptId: attempt.id };
  } catch (error) {
    if (!isUniqueClash(error)) throw error;
    const existing = await db.quizAttempt.findUniqueOrThrow({
      where: { userId_quizId: { userId, quizId } },
      select: { id: true },
    });
    return { ok: true, attemptId: existing.id };
  }
}

export type CloseResult = {
  attemptId: number;
  score: number;
  maxScore: number;
  correctCount: number;
  timeTakenSeconds: number;
  coinsAwarded: number;
};

/**
 * Closes an attempt (submitted by the user at `at`, or run out of time) and
 * credits the coins if the score qualifies, all in one transaction under the
 * user's lock. Closing twice returns the stored result and credits nothing
 * more; the ledger's unique key on the attempt guards it as well.
 */
export async function closeAttempt(attemptId: number, at: Date): Promise<CloseResult | null> {
  const first = await db.quizAttempt.findUnique({ where: { id: attemptId }, select: { userId: true } });
  if (!first) return null;
  const rules = await getSetting("coins.rules");
  return ledgerTransaction(async (tx) => {
    await lockUser(tx, first.userId);
    await tx.$queryRaw`SELECT id FROM QuizAttempt WHERE id = ${attemptId} FOR UPDATE`;
    const attempt = await tx.quizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: {
        quiz: {
          select: {
            passPercent: true,
            questions: { select: { id: true, points: true, options: { select: { id: true, isCorrect: true } } } },
          },
        },
      },
    });
    if (attempt.submittedAt) {
      return {
        attemptId,
        score: attempt.score,
        maxScore: attempt.maxScore,
        correctCount: attempt.correctCount,
        timeTakenSeconds: attempt.timeTakenSeconds,
        coinsAwarded: attempt.coinsAwarded,
      };
    }
    const deadline = deadlineOf(attempt.startedAt);
    const closedAt = at.getTime() > deadline.getTime() ? deadline : at;
    const scored = scoreAnswers(
      attempt.quiz.questions.map((question) => ({
        id: question.id,
        points: question.points,
        correctOptionId: question.options.find((option) => option.isCorrect)?.id ?? null,
      })),
      readAnswers(attempt.answers),
    );
    const coinsAwarded = qualifies(scored.score, scored.maxScore, attempt.quiz.passPercent)
      ? await creditQuizReward(tx, attempt.userId, attemptId, rules)
      : 0;
    const timeTakenSeconds = secondsTaken(attempt.startedAt, closedAt);
    await tx.quizAttempt.update({
      where: { id: attemptId },
      data: { submittedAt: closedAt, ...scored, timeTakenSeconds, coinsAwarded },
    });
    return { attemptId, ...scored, timeTakenSeconds, coinsAwarded };
  });
}

export type SaveResult =
  | { status: "saved" }
  /** Time was up: nothing saved; the attempt is now closed. */
  | { status: "expired" }
  | { status: "finished" }
  | { status: "no_attempt" }
  | { status: "invalid" };

/** Saves (or changes) the answer to one question. Refused after the deadline. */
export async function saveAnswer(
  userId: string,
  quizId: number,
  questionId: number,
  optionId: number,
  now = new Date(),
): Promise<SaveResult> {
  const attempt = await db.quizAttempt.findUnique({
    where: { userId_quizId: { userId, quizId } },
    select: { id: true, startedAt: true, submittedAt: true },
  });
  if (!attempt) return { status: "no_attempt" };
  if (attempt.submittedAt) return { status: "finished" };
  if (now.getTime() > deadlineOf(attempt.startedAt).getTime()) {
    await closeAttempt(attempt.id, now);
    return { status: "expired" };
  }
  // No isCorrect here: this only checks that the option belongs to the question.
  const option = await db.quizOption.findFirst({
    where: { id: optionId, questionId, question: { quizId } },
    select: { id: true },
  });
  if (!option) return { status: "invalid" };

  const outcome = await db.$transaction(async (tx: Client) => {
    await tx.$queryRaw`SELECT id FROM QuizAttempt WHERE id = ${attempt.id} FOR UPDATE`;
    const fresh = await tx.quizAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
      select: { answers: true, submittedAt: true, startedAt: true },
    });
    if (fresh.submittedAt) return "finished" as const;
    if (now.getTime() > deadlineOf(fresh.startedAt).getTime()) return "expired" as const;
    await tx.quizAttempt.update({
      where: { id: attempt.id },
      data: { answers: { ...readAnswers(fresh.answers), [String(questionId)]: optionId } },
    });
    return "saved" as const;
  });
  if (outcome === "expired") await closeAttempt(attempt.id, now);
  return { status: outcome };
}

/** Submits the user's attempt now. Time already up: closes it at the deadline. */
export async function submitAttempt(userId: string, quizId: number, now = new Date()): Promise<CloseResult | null> {
  const attempt = await db.quizAttempt.findUnique({
    where: { userId_quizId: { userId, quizId } },
    select: { id: true },
  });
  return attempt ? closeAttempt(attempt.id, now) : null;
}

/** Closes attempts whose time ran out without a submit (so they count on the leaderboards). */
export async function closeExpiredAttempts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - QUIZ_SECONDS * 1000);
  const stale = await db.quizAttempt.findMany({
    where: { submittedAt: null, startedAt: { lt: cutoff } },
    select: { id: true },
    take: 200,
  });
  for (const attempt of stale) await closeAttempt(attempt.id, now);
  return stale.length;
}
