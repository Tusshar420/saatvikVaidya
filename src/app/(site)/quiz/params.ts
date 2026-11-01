import { z } from "zod";
import type { LeaderboardPeriod } from "@/lib/quiz";

// URL values on /quiz and /quiz/[id], checked before they reach the server code.

/** The side leaderboard's tab: `?board=month`, else this week. */
export function boardOf(value: string | string[] | undefined): LeaderboardPeriod {
  return (Array.isArray(value) ? value[0] : value) === "month" ? "month" : "week";
}

const quizId = z.coerce.number().int().positive().max(2_147_483_647);

/** The quiz id in /quiz/[id], or null when it isn't one. */
export function quizIdOf(value: string): number | null {
  const parsed = quizId.safeParse(value);
  return parsed.success ? parsed.data : null;
}
