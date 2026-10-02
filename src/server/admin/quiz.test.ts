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
    passPercent: "60",
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
    expect(quiz.questions).toEqual(questions.map((q) => ({ ...q, explanation: null })));
  });

  it("reads the week as India time and needs both ends and ten questions", () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ ...questions[0], prompt: `Q${i + 1}` }));
    const ok = form({
      startsAt: "2026-10-05T09:00",
      endsAt: "2026-10-12T09:00",
      questions: JSON.stringify(ten),
    });
    expect(ok.startsAt?.toISOString()).toBe("2026-10-05T03:30:00.000Z");
    expect(ok.endsAt?.toISOString()).toBe("2026-10-12T03:30:00.000Z");
    const base = { title: "T", passPercent: "60", questions: JSON.stringify(ten) };
    const issues = (extra: Record<string, unknown>, q = base.questions) => {
      const result = quizInputSchema.safeParse({ ...base, questions: q, ...extra });
      return result.success ? [] : Object.keys(fieldErrorsOf(result.error));
    };
    expect(issues({ startsAt: "2026-10-05T09:00" })).toContain("endsAt");
    expect(issues({ startsAt: "2026-10-12T09:00", endsAt: "2026-10-05T09:00" })).toContain("endsAt");
    expect(issues({ startsAt: "nonsense", endsAt: "2026-10-05T09:00" })).toContain("startsAt");
    expect(issues({ startsAt: "2026-10-05T09:00", endsAt: "2026-10-12T09:00" }, JSON.stringify(questions))).toContain(
      "questions",
    );
    expect(issues({ passPercent: "0" })).toContain("passPercent");
    expect(issues({ passPercent: "101" })).toContain("passPercent");
  });

  it("points each problem at its question", () => {
    const bad = quizInputSchema.safeParse({
      title: "Broken",
      passPercent: "60",
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
        quizInputSchema.safeParse({ title: "T", passPercent: "60", questions: value }).success,
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
      passPercent: 60,
      questions: questions.map((q) => ({ ...q, explanation: null })),
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
      { prompt: "Ashwagandha is a…", points: 20, options: ["Root", "Leaf"], correct: 0, explanation: "A root." },
    ].map((q) => ({ explanation: null, ...q }));
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

  it("locks the questions once someone has played, but not the schedule", async () => {
    const id = await createQuiz(form(), adminId);
    const quiz = await db.quiz.findUniqueOrThrow({ where: { id } });
    await db.quizAttempt.create({ data: { userId: adminId, quizId: quiz.id, answers: {} } });
    const edited = [{ ...questions[0], prompt: "Changed?" }];
    expect(await updateQuiz(id, form({ questions: JSON.stringify(edited) }), adminId)).toBe("locked");
    expect(await db.quizQuestion.count()).toBe(2);
    // Same questions, new pass mark and week: fine, and the question rows are kept.
    const before = await db.quizQuestion.findMany({ select: { id: true } });
    expect(
      await updateQuiz(id, form({ passPercent: "80", startsAt: "", endsAt: "" }), adminId),
    ).toBe(true);
    expect((await getQuiz(id))?.passPercent).toBe(80);
    expect(await db.quizQuestion.findMany({ select: { id: true } })).toEqual(before);
  });

  it("deletes a quiz with its questions and options", async () => {
    const id = await createQuiz(form(), adminId);
    expect(await deleteQuiz(id, adminId)).toBe(true);
    expect(await db.quizQuestion.count()).toBe(0);
    expect(await db.quizOption.count()).toBe(0);
    expect(await deleteQuiz(id, adminId)).toBe(false);
    expect(await updateQuiz(id, form(), adminId)).toBe(false);
  });

  it("won't delete a quiz someone has played (their results would go with it)", async () => {
    const id = await createQuiz(form(), adminId);
    await db.quizAttempt.create({ data: { userId: adminId, quizId: id, answers: {}, submittedAt: new Date(), score: 10 } });
    expect(await deleteQuiz(id, adminId)).toBe("locked");
    expect(await db.quiz.count({ where: { id } })).toBe(1);
    expect(await db.quizAttempt.count({ where: { quizId: id } })).toBe(1);
    expect(await db.adminLog.count({ where: { action: "quiz.delete" } })).toBe(0);
  });
});
