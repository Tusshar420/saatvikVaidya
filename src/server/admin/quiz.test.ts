import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { clearContentTables } from "../../../tests/setup/content-db";
import { resetAuthData, userTypeIds } from "../../../tests/setup/auth";
import { fieldErrorsOf } from "./form";
import {
  createQuiz,
  deleteQuiz,
  getQuiz,
  listQuizzes,
  quizInputSchema,
  updateQuiz,
} from "./quiz";

const adminId = "quiz-admin";

const questions = [
  { prompt: "Which dosha governs movement?", points: 10, options: ["Vata", "Pitta", "Kapha"], correct: 0 },
  { prompt: "Triphala has how many fruits?", points: 5, options: ["Two", "Three"], correct: 1 },
];

function form(overrides: Record<string, unknown> = {}) {
  return quizInputSchema.parse({
    title: "Dosha basics",
    description: "",
    active: "on",
    questions: JSON.stringify(questions),
    ...overrides,
  });
}

beforeEach(async () => {
  await clearContentTables(db);
  await resetAuthData(db);
  const types = await userTypeIds(db);
  await db.user.create({
    data: {
      id: adminId,
      name: "Quiz Admin",
      email: "quiz-admin@example.test",
      role: "admin",
      userTypeId: types.customer,
      termsAcceptedAt: new Date(),
    },
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("quiz input", () => {
  it("parses the builder's JSON questions", () => {
    const quiz = form();
    expect(quiz).toMatchObject({ title: "Dosha basics", description: null, active: true });
    expect(quiz.questions).toEqual(questions);
  });

  it("points each problem at its question", () => {
    const bad = quizInputSchema.safeParse({
      title: "Broken",
      questions: JSON.stringify([
        questions[0],
        { prompt: "", points: 5, options: ["Only one"], correct: 3 },
      ]),
    });
    expect(bad.success).toBe(false);
    if (bad.success) return;
    const errors = fieldErrorsOf(bad.error);
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining([
        "questions.1.prompt",
        "questions.1.options",
      ]),
    );
  });

  it("refuses no questions, bad JSON, too many options and a wrong answer index", () => {
    const tries = [
      JSON.stringify([]),
      "{not json",
      JSON.stringify([{ ...questions[0], options: ["a", "b", "c", "d", "e", "f", "g"] }]),
      JSON.stringify([{ ...questions[0], correct: 3 }]),
      JSON.stringify([{ ...questions[0], points: -1 }]),
      JSON.stringify([{ ...questions[0], options: ["a", " "] }]),
    ];
    for (const value of tries) {
      expect(
        quizInputSchema.safeParse({ title: "T", questions: value }).success,
        value,
      ).toBe(false);
    }
  });
});

describe("quiz storage", () => {
  it("creates a quiz and reads it back in order", async () => {
    const id = await createQuiz(form(), adminId);
    expect(await getQuiz(id)).toMatchObject({
      title: "Dosha basics",
      active: true,
      questions,
    });
    expect(await listQuizzes()).toEqual([
      expect.objectContaining({ id, questionCount: 2, totalPoints: 15 }),
    ]);
    const options = await db.quizOption.findMany({ where: { isCorrect: true } });
    expect(options.map((option) => option.text).sort()).toEqual(["Three", "Vata"]);
  });

  it("replaces questions on edit (reordered, one added) and logs it", async () => {
    const id = await createQuiz(form(), adminId);
    const edited = [
      questions[1],
      questions[0],
      { prompt: "Ashwagandha is a…", points: 20, options: ["Root", "Leaf"], correct: 0 },
    ];
    expect(
      await updateQuiz(id, form({ questions: JSON.stringify(edited) }), adminId),
    ).toBe(true);
    expect((await getQuiz(id))?.questions).toEqual(edited);
    // Old questions don't linger.
    expect(await db.quizQuestion.count()).toBe(3);
    const log = await db.adminLog.findFirstOrThrow({ where: { action: "quiz.update" } });
    expect(log.changes).toMatchObject({
      questions: { from: 2, to: 3 },
      questionsEdited: { from: false, to: true },
    });
    expect(JSON.stringify(log.changes)).not.toContain("Ashwagandha");
  });

  it("deletes a quiz with its questions and options", async () => {
    const id = await createQuiz(form(), adminId);
    expect(await deleteQuiz(id, adminId)).toBe(true);
    expect(await db.quizQuestion.count()).toBe(0);
    expect(await db.quizOption.count()).toBe(0);
    expect(await deleteQuiz(id, adminId)).toBe(false);
    expect(await updateQuiz(id, form(), adminId)).toBe(false);
  });
});
