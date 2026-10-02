import "server-only";
import { deadlineOf, periodEnd, periodStart, publicName, rankEntries, type LeaderboardPeriod } from "@/lib/quiz";
import { db } from "@/server/db";
import { closeAttempt, closeExpiredAttempts, findNextQuiz, findOpenQuiz, readAnswers } from "./attempts";

// What the quiz pages show. Questions are sent without `isCorrect`; the
// answers and explanations come only with the "finished" view.

export type PlayQuestion = {
  id: number;
  prompt: string;
  points: number;
  options: { id: number; text: string }[];
};

export type ReviewQuestion = PlayQuestion & {
  explanation: string | null;
  correctOptionId: number | null;
  chosenOptionId: number | null;
};

export type QuizPageView =
  | { state: "none"; next: { title: string; startsAt: Date } | null }
  | {
      state: "ready";
      passPercent: number;
      quiz: { id: number; title: string; description: string | null; endsAt: Date; questionCount: number };
    }
  | {
      state: "playing";
      quiz: { id: number; title: string };
      questions: PlayQuestion[];
      answers: Record<string, number>;
      /** Server time left, so a wrong device clock doesn't matter. */
      secondsLeft: number;
    }
  | {
      state: "finished";
      quiz: { id: number; title: string };
      result: { score: number; maxScore: number; correctCount: number; timeTakenSeconds: number; coinsAwarded: number };
      passPercent: number;
      review: ReviewQuestion[];
    };

/** The quiz open now (or the user's finished one) for the /quiz page. */
export async function getQuizPage(userId: string | null, now = new Date()): Promise<QuizPageView> {
  const open = await findOpenQuiz(now);
  if (!open) {
    // The user's latest attempt that finished while no quiz is open isn't shown here;
    // the leaderboard has it.
    const next = await findNextQuiz(now);
    return { state: "none", next: next?.startsAt ? { title: next.title, startsAt: next.startsAt } : null };
  }
  const attempt = userId
    ? await db.quizAttempt.findUnique({ where: { userId_quizId: { userId, quizId: open.id } } })
    : null;
  if (!attempt) {
    return {
      state: "ready",
      passPercent: open.passPercent,
      quiz: {
        id: open.id,
        title: open.title,
        description: open.description,
        endsAt: open.endsAt!,
        questionCount: open._count.questions,
      },
    };
  }
  const closed = attempt.submittedAt
    ? attempt
    : now.getTime() > deadlineOf(attempt.startedAt).getTime()
      ? (await closeAttempt(attempt.id, now), await db.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } }))
      : null;
  if (!closed) {
    const questions = await db.quizQuestion.findMany({
      where: { quizId: open.id },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      // No `isCorrect`: nothing about the right answers goes to the player.
      select: {
        id: true,
        prompt: true,
        points: true,
        options: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, text: true } },
      },
    });
    return {
      state: "playing",
      quiz: { id: open.id, title: open.title },
      questions,
      answers: readAnswers(attempt.answers),
      secondsLeft: Math.max(0, Math.ceil((deadlineOf(attempt.startedAt).getTime() - now.getTime()) / 1000)),
    };
  }
  return finishedView(closed, open.title, open.passPercent);
}

/** The user's finished attempt on a quiz, with answers and explanations. */
async function finishedView(
  attempt: {
    id: number;
    quizId: number;
    answers: unknown;
    score: number;
    maxScore: number;
    correctCount: number;
    timeTakenSeconds: number;
    coinsAwarded: number;
  },
  title: string,
  passPercent: number,
): Promise<QuizPageView> {
  const answers = readAnswers(attempt.answers);
  const questions = await db.quizQuestion.findMany({
    where: { quizId: attempt.quizId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      prompt: true,
      points: true,
      explanation: true,
      options: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, text: true, isCorrect: true } },
    },
  });
  return {
    state: "finished",
    quiz: { id: attempt.quizId, title },
    result: {
      score: attempt.score,
      maxScore: attempt.maxScore,
      correctCount: attempt.correctCount,
      timeTakenSeconds: attempt.timeTakenSeconds,
      coinsAwarded: attempt.coinsAwarded,
    },
    passPercent,
    review: questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      points: question.points,
      explanation: question.explanation,
      options: question.options.map(({ id, text }) => ({ id, text })),
      correctOptionId: question.options.find((option) => option.isCorrect)?.id ?? null,
      chosenOptionId: answers[String(question.id)] ?? null,
    })),
  };
}

export type LeaderboardRow = { rank: number; name: string; score: number; seconds: number; isYou: boolean };

export type Leaderboard = {
  period: LeaderboardPeriod;
  from: Date;
  until: Date;
  rows: LeaderboardRow[];
  /** The signed-in user's own place, even when outside the top rows. */
  you: LeaderboardRow | null;
};

export const LEADERBOARD_SIZE = 20;

/**
 * The India-time week or month so far: each user's points and time added up
 * over their finished attempts that started in it, ranked by points then time.
 * Names are first name and last initial, made here; no ids leave the server.
 */
export async function readLeaderboard(
  period: LeaderboardPeriod,
  viewerId: string | null,
  now = new Date(),
): Promise<Leaderboard> {
  await closeExpiredAttempts(now);
  const from = periodStart(period, now);
  const until = periodEnd(period, now);
  const attempts = await db.quizAttempt.findMany({
    where: { submittedAt: { not: null }, startedAt: { gte: from, lt: until } },
    select: { userId: true, score: true, timeTakenSeconds: true, user: { select: { name: true } } },
  });
  const totals = new Map<string, { userId: string; name: string; score: number; seconds: number }>();
  for (const attempt of attempts) {
    const entry = totals.get(attempt.userId) ?? {
      userId: attempt.userId,
      name: publicName(attempt.user.name),
      score: 0,
      seconds: 0,
    };
    entry.score += attempt.score;
    entry.seconds += attempt.timeTakenSeconds;
    totals.set(attempt.userId, entry);
  }
  const ranked = rankEntries([...totals.values()]).map((entry) => ({
    rank: entry.rank,
    name: entry.name,
    score: entry.score,
    seconds: entry.seconds,
    isYou: entry.userId === viewerId,
  }));
  return {
    period,
    from,
    until,
    rows: ranked.slice(0, LEADERBOARD_SIZE),
    you: ranked.find((row) => row.isYou) ?? null,
  };
}

export type HomeQuiz =
  | { kind: "open"; title: string; questionCount: number; endsAt: Date }
  | { kind: "next"; startsAt: Date }
  | { kind: "none" };

/** What the homepage's Quiz & Win section shows: the open quiz, the next one, or neither. */
export async function getHomeQuiz(now = new Date()): Promise<HomeQuiz> {
  const open = await findOpenQuiz(now);
  if (open?.endsAt) {
    return { kind: "open", title: open.title, questionCount: open._count.questions, endsAt: open.endsAt };
  }
  const next = await findNextQuiz(now);
  return next?.startsAt ? { kind: "next", startsAt: next.startsAt } : { kind: "none" };
}
