// Quiz & Win arithmetic (docs/CHUNKS.md, P2.3): pure functions with no
// database access, shared by the server and the pages. The server code is in
// src/server/quiz.

/** Questions in a scheduled quiz. */
export const QUIZ_QUESTION_COUNT = 10;
/** Time allowed once the attempt starts. */
export const QUIZ_SECONDS = 5 * 60;

/** India has one time zone (UTC+5:30, no daylight saving); weeks follow it. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The moment the attempt's time runs out. */
export function deadlineOf(startedAt: Date): Date {
  return new Date(startedAt.getTime() + QUIZ_SECONDS * 1000);
}

/** Whole seconds from `startedAt` to `at`, held between 0 and the time limit. */
export function secondsTaken(startedAt: Date, at: Date): number {
  const seconds = Math.ceil((at.getTime() - startedAt.getTime()) / 1000);
  return Math.min(QUIZ_SECONDS, Math.max(0, seconds));
}

export type ScoredQuestion = { id: number; points: number; correctOptionId: number | null };

export type Score = { score: number; maxScore: number; correctCount: number };

/**
 * Adds up the points of the questions answered with their correct option.
 * `answers` maps a question id to the chosen option id; unknown questions are
 * ignored, so a tampered answer can't add points.
 */
export function scoreAnswers(questions: readonly ScoredQuestion[], answers: Readonly<Record<string, number>>): Score {
  let score = 0;
  let maxScore = 0;
  let correctCount = 0;
  for (const question of questions) {
    maxScore += question.points;
    if (question.correctOptionId !== null && answers[String(question.id)] === question.correctOptionId) {
      score += question.points;
      correctCount += 1;
    }
  }
  return { score, maxScore, correctCount };
}

/** Whether `score` earns the coins: at least `passPercent` of the points (and some points). */
export function qualifies(score: number, maxScore: number, passPercent: number): boolean {
  if (maxScore <= 0 || score <= 0) return false;
  return score * 100 >= passPercent * maxScore;
}

/** "Asha Rao" is shown as "Asha R."; a single name is shown as it is. */
export function publicName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Learner";
  const first = parts[0]!;
  if (parts.length === 1) return first;
  const initial = Array.from(parts[parts.length - 1]!)[0]!.toUpperCase();
  return `${first} ${initial}.`;
}

export type LeaderboardPeriod = "week" | "month";

/** The first moment of this India-time week (Monday) or month. */
export function periodStart(period: LeaderboardPeriod, now: Date): Date {
  const local = new Date(now.getTime() + IST_OFFSET_MS);
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const start =
    period === "month"
      ? Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1)
      : day - ((local.getUTCDay() + 6) % 7) * 24 * 60 * 60 * 1000;
  return new Date(start - IST_OFFSET_MS);
}

/** The moment the period after `periodStart` begins. */
export function periodEnd(period: LeaderboardPeriod, now: Date): Date {
  const start = periodStart(period, now);
  if (period === "week") return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const local = new Date(start.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - IST_OFFSET_MS);
}

export type RankInput = { userId: string; score: number; seconds: number };

/**
 * Ranks by score (high first), then time taken (low first). Entries equal on
 * both share a rank, and the next rank skips (1, 1, 3).
 */
export function rankEntries<T extends RankInput>(entries: readonly T[]): (T & { rank: number })[] {
  const sorted = [...entries].sort(
    (a, b) => b.score - a.score || a.seconds - b.seconds || a.userId.localeCompare(b.userId),
  );
  let rank = 0;
  return sorted.map((entry, index) => {
    const previous = sorted[index - 1];
    if (!previous || previous.score !== entry.score || previous.seconds !== entry.seconds) rank = index + 1;
    return { ...entry, rank };
  });
}

/** An India-time datetime-local value ("2026-10-05T09:00") as an instant; null if not valid. */
export function parseIstLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const at = new Date(Date.UTC(y, mo - 1, d, h, mi) - IST_OFFSET_MS);
  const back = new Date(at.getTime() + IST_OFFSET_MS);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return at;
}

/** An instant as an India-time datetime-local value. */
export function formatIstLocal(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}
