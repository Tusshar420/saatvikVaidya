import "server-only";
import {
  QUIZ_QUESTION_COUNT,
  deadlineOf,
  periodEnd,
  periodStart,
  publicName,
  rankEntries,
  type LeaderboardPeriod,
} from "@/lib/quiz";
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
  | { state: "upcoming"; quiz: { id: number; title: string; description: string | null; startsAt: Date } }
  | { state: "closed"; quiz: { id: number; title: string; description: string | null } }
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

/**
 * One quiz's page, /quiz/[id]. Null when it isn't a published, scheduled quiz
 * with all its questions. A player's own attempt is shown (in play or with its
 * result) even after the quiz has closed; otherwise it is ready to start
 * inside its week, and "upcoming" or "closed" outside it.
 */
export async function getQuizPage(userId: string | null, quizId: number, now = new Date()): Promise<QuizPageView | null> {
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, active: true, startsAt: { not: null }, endsAt: { not: null } },
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
  if (!quiz?.startsAt || !quiz.endsAt || quiz._count.questions !== QUIZ_QUESTION_COUNT) return null;
  const attempt = userId
    ? await db.quizAttempt.findUnique({ where: { userId_quizId: { userId, quizId: quiz.id } } })
    : null;
  if (!attempt) {
    const about = { id: quiz.id, title: quiz.title, description: quiz.description };
    if (now < quiz.startsAt) return { state: "upcoming", quiz: { ...about, startsAt: quiz.startsAt } };
    if (now >= quiz.endsAt) return { state: "closed", quiz: about };
    return {
      state: "ready",
      passPercent: quiz.passPercent,
      quiz: { ...about, endsAt: quiz.endsAt, questionCount: quiz._count.questions },
    };
  }
  const closed = attempt.submittedAt
    ? attempt
    : now.getTime() > deadlineOf(attempt.startedAt).getTime()
      ? (await closeAttempt(attempt.id, now), await db.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } }))
      : null;
  if (!closed) {
    const questions = await db.quizQuestion.findMany({
      where: { quizId: quiz.id },
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
      quiz: { id: quiz.id, title: quiz.title },
      questions,
      answers: readAnswers(attempt.answers),
      secondsLeft: Math.max(0, Math.ceil((deadlineOf(attempt.startedAt).getTime() - now.getTime()) / 1000)),
    };
  }
  return finishedView(closed, quiz.title, quiz.passPercent);
}

export type QuizBox = {
  id: number;
  title: string;
  /** The quiz's mark, else its category's; null shows the default. */
  glyph: string | null;
  questionCount: number;
  startsAt: Date;
  endsAt: Date;
  /** Open now, or opening later. */
  open: boolean;
  /** The viewer's own go at it, if any. */
  played: "playing" | "done" | null;
};

/** A heading on /quiz and its quizzes. `name` null: the quizzes with no (shown) category. */
export type QuizGroup = { key: string; name: string | null; quizzes: QuizBox[] };

/**
 * The /quiz boxes: every published quiz that is open now or scheduled to
 * open, grouped under its category in the admin's order (open ones first,
 * then by opening time). Quizzes with no category, or a hidden one, come last.
 */
export async function listQuizGroups(userId: string | null, now = new Date()): Promise<QuizGroup[]> {
  const quizzes = await db.quiz.findMany({
    where: { active: true, startsAt: { not: null }, endsAt: { gt: now } },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      glyph: true,
      startsAt: true,
      endsAt: true,
      category: { select: { id: true, key: true, name: true, glyph: true, active: true, sortOrder: true } },
      _count: { select: { questions: true } },
    },
  });
  const playable = quizzes.filter((quiz) => quiz._count.questions === QUIZ_QUESTION_COUNT);
  const attempts = userId
    ? await db.quizAttempt.findMany({
        where: { userId, quizId: { in: playable.map((quiz) => quiz.id) } },
        select: { quizId: true, startedAt: true, submittedAt: true },
      })
    : [];
  const playedOf = new Map(
    attempts.map((attempt) => [
      attempt.quizId,
      !attempt.submittedAt && now <= deadlineOf(attempt.startedAt) ? ("playing" as const) : ("done" as const),
    ]),
  );

  const groups = new Map<string, QuizGroup & { order: [number, number, number] }>();
  for (const quiz of playable) {
    const category = quiz.category?.active ? quiz.category : null;
    const key = category?.key ?? "";
    const group = groups.get(key) ?? {
      key: key || "more",
      name: category?.name ?? null,
      quizzes: [],
      // Categories in the admin's order; no category goes last.
      order: category ? [0, category.sortOrder, category.id] : [1, 0, 0],
    };
    group.quizzes.push({
      id: quiz.id,
      title: quiz.title,
      glyph: quiz.glyph ?? quiz.category?.glyph ?? null,
      questionCount: quiz._count.questions,
      startsAt: quiz.startsAt!,
      endsAt: quiz.endsAt!,
      open: quiz.startsAt! <= now,
      played: playedOf.get(quiz.id) ?? null,
    });
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2])
    .map(({ key, name, quizzes: boxes }) => ({
      key,
      name,
      // Stable sort: open ones first, each part still by opening time.
      quizzes: boxes.sort((a, b) => Number(b.open) - Number(a.open)),
    }));
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
