import { describe, expect, it } from "vitest";
import {
  QUIZ_SECONDS,
  deadlineOf,
  formatIstLocal,
  parseIstLocal,
  periodEnd,
  periodStart,
  publicName,
  qualifies,
  rankEntries,
  scoreAnswers,
  secondsTaken,
} from "./quiz";

const questions = [
  { id: 1, points: 10, correctOptionId: 11 },
  { id: 2, points: 5, correctOptionId: 21 },
  { id: 3, points: 10, correctOptionId: 31 },
];

describe("scoring", () => {
  it("adds the points of the correct answers only", () => {
    expect(scoreAnswers(questions, { "1": 11, "2": 22, "3": 31 })).toEqual({
      score: 20,
      maxScore: 25,
      correctCount: 2,
    });
  });

  it("scores unanswered as zero and ignores answers to unknown questions", () => {
    expect(scoreAnswers(questions, {})).toEqual({ score: 0, maxScore: 25, correctCount: 0 });
    expect(scoreAnswers(questions, { "99": 11 }).score).toBe(0);
  });

  it("never scores a question that has no correct option", () => {
    expect(scoreAnswers([{ id: 1, points: 10, correctOptionId: null }], { "1": 0 }).score).toBe(0);
  });

  it("qualifies at or above the pass mark, never at zero", () => {
    expect(qualifies(60, 100, 60)).toBe(true);
    expect(qualifies(59, 100, 60)).toBe(false);
    expect(qualifies(0, 100, 1)).toBe(false);
    expect(qualifies(0, 0, 1)).toBe(false);
    expect(qualifies(3, 5, 60)).toBe(true);
  });
});

describe("the timer", () => {
  const start = new Date("2026-10-05T10:00:00.000Z");

  it("runs 5 minutes from the start", () => {
    expect(QUIZ_SECONDS).toBe(300);
    expect(deadlineOf(start).toISOString()).toBe("2026-10-05T10:05:00.000Z");
  });

  it("counts whole seconds, rounding up, held to the limit", () => {
    expect(secondsTaken(start, new Date(start.getTime() + 1))).toBe(1);
    expect(secondsTaken(start, new Date(start.getTime() + 61_000))).toBe(61);
    expect(secondsTaken(start, new Date(start.getTime() + 999_000))).toBe(300);
    expect(secondsTaken(start, new Date(start.getTime() - 5_000))).toBe(0);
  });
});

describe("names", () => {
  it("shows the first name and the last initial", () => {
    expect(publicName("Asha Rao")).toBe("Asha R.");
    expect(publicName("  dr. asha  kumar rao ")).toBe("dr. R.");
    expect(publicName("Asha")).toBe("Asha");
    expect(publicName("   ")).toBe("Learner");
    expect(publicName("Asha Ñandi")).toBe("Asha Ñ.");
  });
});

describe("ranking", () => {
  it("orders by score, then by the shorter time, and shares equal ranks", () => {
    const ranked = rankEntries([
      { userId: "a", score: 50, seconds: 200 },
      { userId: "b", score: 70, seconds: 250 },
      { userId: "c", score: 70, seconds: 100 },
      { userId: "d", score: 50, seconds: 200 },
      { userId: "e", score: 10, seconds: 5 },
    ]);
    expect(ranked.map((r) => [r.userId, r.rank])).toEqual([
      ["c", 1],
      ["b", 2],
      ["a", 3],
      ["d", 3],
      ["e", 5],
    ]);
  });
});

describe("leaderboard periods (India time)", () => {
  it("starts the week on Monday 00:00 IST", () => {
    // Wed 7 Oct 2026, 10:00 IST.
    const now = new Date("2026-10-07T04:30:00.000Z");
    expect(periodStart("week", now).toISOString()).toBe("2026-10-04T18:30:00.000Z");
    expect(periodEnd("week", now).toISOString()).toBe("2026-10-11T18:30:00.000Z");
  });

  it("uses India's date, not UTC's, near midnight", () => {
    // Sun 4 Oct 2026, 23:59 UTC is Mon 5 Oct 05:29 IST: a new week already.
    const now = new Date("2026-10-04T23:59:00.000Z");
    expect(periodStart("week", now).toISOString()).toBe("2026-10-04T18:30:00.000Z");
  });

  it("starts the month on the 1st at 00:00 IST", () => {
    const now = new Date("2026-10-31T20:00:00.000Z"); // 1 Nov 01:30 IST
    expect(periodStart("month", now).toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(periodEnd("month", now).toISOString()).toBe("2026-11-30T18:30:00.000Z");
  });
});

describe("schedule values", () => {
  it("reads and writes India-time form values", () => {
    const at = parseIstLocal("2026-10-05T09:00");
    expect(at?.toISOString()).toBe("2026-10-05T03:30:00.000Z");
    expect(formatIstLocal(at!)).toBe("2026-10-05T09:00");
  });

  it("refuses values that aren't real dates", () => {
    expect(parseIstLocal("2026-02-30T09:00")).toBeNull();
    expect(parseIstLocal("tomorrow")).toBeNull();
    expect(parseIstLocal("2026-10-05")).toBeNull();
  });
});
