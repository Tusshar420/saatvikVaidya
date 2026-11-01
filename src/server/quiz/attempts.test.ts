import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { QUIZ_SECONDS } from "@/lib/quiz";
import { updateCoinRules } from "@/server/coins/rules";
import { settingDefaults } from "@/content/settings";
import { db } from "@/server/db";
import { seedDatabase } from "@/server/seed";
import { clearAuthTables, clearContentTables } from "../../../tests/setup/content-db";
import { makeUser } from "../../../tests/setup/shop";
import { closeExpiredAttempts, findOpenQuiz, saveAnswer, startAttempt, submitAttempt } from "./attempts";
import { getHomeQuiz, getQuizPage, listQuizGroups, readLeaderboard } from "./view";

// Quiz & Win (P2.3): who can start, the server's clock, the one attempt,
// scoring, the single coin credit, answer leakage and the leaderboards.

const DAY = 24 * 60 * 60 * 1000;

type QuizFixture = Awaited<ReturnType<typeof makeQuiz>>;

/** A 10-question quiz (10 points each, the first option right) open around `now`. */
async function makeQuiz(
  options: { now?: Date; questions?: number; active?: boolean; passPercent?: number; scheduled?: boolean } = {},
) {
  const now = options.now ?? new Date();
  const quiz = await db.quiz.create({
    data: {
      title: "Weekly quiz",
      active: options.active ?? true,
      passPercent: options.passPercent ?? 60,
      startsAt: options.scheduled === false ? null : new Date(now.getTime() - DAY),
      endsAt: options.scheduled === false ? null : new Date(now.getTime() + 6 * DAY),
      questions: {
        create: Array.from({ length: options.questions ?? 10 }, (_, i) => ({
          sortOrder: (i + 1) * 10,
          prompt: `Question ${i + 1}`,
          points: 10,
          explanation: `Because ${i + 1}`,
          options: {
            create: [
              { sortOrder: 10, text: "Right", isCorrect: true },
              { sortOrder: 20, text: "Wrong", isCorrect: false },
            ],
          },
        })),
      },
    },
    include: { questions: { include: { options: true }, orderBy: { sortOrder: "asc" } } },
  });
  const right = (index: number) => quiz.questions[index]!.options.find((o) => o.isCorrect)!;
  const wrong = (index: number) => quiz.questions[index]!.options.find((o) => !o.isCorrect)!;
  return { quiz, right, wrong, questionId: (index: number) => quiz.questions[index]!.id };
}

/** Starts for `userId` and answers the first `correct` questions right and the rest wrong. */
async function play(userId: string, fx: QuizFixture, correct: number, at: Date, submitAfterSeconds = 60) {
  const started = await startAttempt(userId, fx.quiz.id, at);
  if (!started.ok) throw new Error("not started");
  for (let i = 0; i < 10; i++) {
    const option = i < correct ? fx.right(i) : fx.wrong(i);
    const saved = await saveAnswer(userId, fx.quiz.id, fx.questionId(i), option.id, new Date(at.getTime() + 1000));
    if (saved.status !== "saved") throw new Error(saved.status);
  }
  return submitAttempt(userId, fx.quiz.id, new Date(at.getTime() + submitAfterSeconds * 1000));
}

const coinBalance = async (userId: string) =>
  (await db.coinLedger.aggregate({ where: { userId }, _sum: { amount: true } }))._sum.amount ?? 0;

beforeAll(async () => {
  await clearContentTables(db);
  await seedDatabase(db);
});

beforeEach(async () => {
  await clearAuthTables(db);
  await db.quiz.deleteMany();
  await db.quizCategory.deleteMany({ where: { key: { startsWith: "t-" } } });
  await db.setting.update({ where: { key: "coins.rules" }, data: { value: settingDefaults["coins.rules"] } });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("which quiz is open", () => {
  it("is the active scheduled quiz inside its week", async () => {
    const fx = await makeQuiz();
    expect((await findOpenQuiz(new Date()))?.id).toBe(fx.quiz.id);
    expect(await findOpenQuiz(new Date(Date.now() + 10 * DAY))).toBeNull();
    expect(await findOpenQuiz(new Date(Date.now() - 3 * DAY))).toBeNull();
  });

  it("ignores drafts, unscheduled quizzes and ones without exactly 10 questions", async () => {
    await makeQuiz({ active: false });
    await makeQuiz({ scheduled: false });
    await makeQuiz({ questions: 9 });
    expect(await findOpenQuiz(new Date())).toBeNull();
    expect(await getHomeQuiz()).toEqual({ kind: "none" });
  });

  it("shows the next quiz on the homepage when none is open", async () => {
    const startsAt = new Date(Date.now() + 3 * DAY);
    await db.quiz.create({ data: { title: "Soon", active: true, startsAt, endsAt: new Date(+startsAt + 7 * DAY) } });
    expect(await getHomeQuiz()).toEqual({ kind: "next", startsAt });
  });

  it("shows the open quiz on the homepage", async () => {
    const fx = await makeQuiz();
    expect(await getHomeQuiz()).toMatchObject({ kind: "open", title: fx.quiz.title, questionCount: 10 });
  });
});

describe("starting", () => {
  it("allows one attempt per user per quiz", async () => {
    const fx = await makeQuiz();
    const userId = await makeUser(db);
    const first = await startAttempt(userId, fx.quiz.id);
    const again = await startAttempt(userId, fx.quiz.id, new Date(Date.now() + 60_000));
    expect(first).toMatchObject({ ok: true });
    expect(again).toEqual(first);
    expect(await db.quizAttempt.count()).toBe(1);
  });

  it("handles two starts at once as one attempt", async () => {
    const fx = await makeQuiz();
    const userId = await makeUser(db);
    const results = await Promise.all([startAttempt(userId, fx.quiz.id), startAttempt(userId, fx.quiz.id)]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await db.quizAttempt.count()).toBe(1);
  });

  it("refuses a quiz that isn't open, or a different one than the open quiz", async () => {
    const closed = await makeQuiz({ active: false });
    const open = await makeQuiz();
    const userId = await makeUser(db);
    expect(await startAttempt(userId, closed.quiz.id)).toEqual({ ok: false, error: "closed" });
    expect(await startAttempt(userId, 999_999)).toEqual({ ok: false, error: "closed" });
    expect(await startAttempt(userId, open.quiz.id)).toMatchObject({ ok: true });
  });

  it("keeps the start time the server set, so starting again can't restart the clock", async () => {
    const fx = await makeQuiz();
    const userId = await makeUser(db);
    const t0 = new Date();
    await startAttempt(userId, fx.quiz.id, t0);
    await startAttempt(userId, fx.quiz.id, new Date(t0.getTime() + 200_000));
    const attempt = await db.quizAttempt.findFirstOrThrow();
    expect(attempt.startedAt.getTime()).toBe(t0.getTime());
  });
});

describe("answering and the timer", () => {
  it("saves answers as they come, and a changed answer replaces the old one", async () => {
    const fx = await makeQuiz();
    const userId = await makeUser(db);
    const t0 = new Date();
    await startAttempt(userId, fx.quiz.id, t0);
    await saveAnswer(userId, fx.quiz.id, fx.questionId(0), fx.wrong(0).id, t0);
    await saveAnswer(userId, fx.quiz.id, fx.questionId(0), fx.right(0).id, t0);
    const attempt = await db.quizAttempt.findFirstOrThrow();
    expect(attempt.answers).toEqual({ [fx.questionId(0)]: fx.right(0).id });
  });

  it("counts an answer at the last second and refuses one after the deadline", async () => {
    const fx = await makeQuiz();
    const userId = await makeUser(db);
    const t0 = new Date();
    await startAttempt(userId, fx.quiz.id, t0);
    const onTime = new Date(t0.getTime() + QUIZ_SECONDS * 1000);
    const late = new Date(onTime.getTime() + 1);
    expect(await saveAnswer(userId, fx.quiz.id, fx.questionId(0), fx.right(0).id, onTime)).toEqual({ status: "saved" });
    expect(await saveAnswer(userId, fx.quiz.id, fx.questionId(1), fx.right(1).id, late)).toEqual({
      status: "expired",
    });
    const attempt = await db.quizAttempt.findFirstOrThrow();
    expect(attempt.submittedAt).not.toBeNull();
    expect(attempt.answers).toEqual({ [fx.questionId(0)]: fx.right(0).id });
    expect(attempt.score).toBe(10);
    expect(attempt.timeTakenSeconds).toBe(QUIZ_SECONDS);
  });

  it("refuses an answer after submitting", async () => {
    const fx = await makeQuiz();
    const userId = await makeUser(db);
    const t0 = new Date();
    await startAttempt(userId, fx.quiz.id, t0);
    await submitAttempt(userId, fx.quiz.id, new Date(t0.getTime() + 5_000));
    expect(await saveAnswer(userId, fx.quiz.id, fx.questionId(0), fx.right(0).id, t0)).toEqual({ status: "finished" });
  });

  it("refuses options that don't belong to the question or the quiz, and answers with no attempt", async () => {
    const other = await makeQuiz();
    const fx = await makeQuiz();
    const userId = await makeUser(db);
    expect(await saveAnswer(userId, fx.quiz.id, fx.questionId(0), fx.right(0).id)).toEqual({ status: "no_attempt" });
    await startAttempt(userId, fx.quiz.id);
    expect(await saveAnswer(userId, fx.quiz.id, fx.questionId(0), fx.right(1).id)).toEqual({ status: "invalid" });
    expect(await saveAnswer(userId, fx.quiz.id, other.questionId(0), other.right(0).id)).toEqual({ status: "invalid" });
    expect((await db.quizAttempt.findFirstOrThrow()).answers).toEqual({});
  });

  it("only changes the caller's own attempt", async () => {
    const fx = await makeQuiz();
    const [a, b] = [await makeUser(db), await makeUser(db)];
    await startAttempt(a, fx.quiz.id);
    await startAttempt(b, fx.quiz.id);
    await saveAnswer(a, fx.quiz.id, fx.questionId(0), fx.right(0).id);
    const attemptB = await db.quizAttempt.findFirstOrThrow({ where: { userId: b } });
    expect(attemptB.answers).toEqual({});
  });

  it("scores an expired attempt that was never submitted, on the next read, at the full time", async () => {
    const fx = await makeQuiz();
    const userId = await makeUser(db);
    const t0 = new Date(Date.now() - 20 * 60_000);
    await startAttempt(userId, fx.quiz.id, t0);
    for (let i = 0; i < 7; i++) await saveAnswer(userId, fx.quiz.id, fx.questionId(i), fx.right(i).id, t0);
    expect(await closeExpiredAttempts(new Date())).toBe(1);
    const attempt = await db.quizAttempt.findFirstOrThrow();
    expect(attempt).toMatchObject({ score: 70, correctCount: 7, timeTakenSeconds: QUIZ_SECONDS, coinsAwarded: 100 });
  });
});

describe("scoring and coins", () => {
  it("scores, records the time taken and credits the coins once", async () => {
    const fx = await makeQuiz();
    const userId = await makeUser(db);
    const result = await play(userId, fx, 8, new Date(), 95);
    expect(result).toMatchObject({ score: 80, maxScore: 100, correctCount: 8, timeTakenSeconds: 95, coinsAwarded: 100 });
    expect(await coinBalance(userId)).toBe(100);
    const row = await db.coinLedger.findFirstOrThrow({ where: { userId } });
    expect(row).toMatchObject({ reason: "earn_quiz", amount: 100 });
    expect(row.reference).toBe(`quiz-attempt:${result!.attemptId}`);
    expect(row.expiresAt).not.toBeNull();
  });

  it("credits nothing below the pass mark", async () => {
    const fx = await makeQuiz({ passPercent: 70 });
    const userId = await makeUser(db);
    const result = await play(userId, fx, 6, new Date());
    expect(result).toMatchObject({ score: 60, coinsAwarded: 0 });
    expect(await coinBalance(userId)).toBe(0);
  });

  it("uses the coin rule's amount, and credits nothing when it is 0 or coins are off", async () => {
    const admin = await makeUser(db);
    const rules = settingDefaults["coins.rules"];
    const fx1 = await makeQuiz();
    const user1 = await makeUser(db);
    await updateCoinRules(admin, { ...rules, quizReward: 250 });
    expect((await play(user1, fx1, 10, new Date()))?.coinsAwarded).toBe(250);

    const fx2 = await makeQuiz();
    const user2 = await makeUser(db);
    await updateCoinRules(admin, { ...rules, quizReward: 0 });
    expect((await play(user2, fx2, 10, new Date()))?.coinsAwarded).toBe(0);

    const fx3 = await makeQuiz();
    const user3 = await makeUser(db);
    await updateCoinRules(admin, { ...rules, quizReward: 250, enabled: false });
    expect((await play(user3, fx3, 10, new Date()))?.coinsAwarded).toBe(0);
    expect(await db.coinLedger.count({ where: { reason: "earn_quiz" } })).toBe(1);
  });

  it("credits once however many times it is submitted, even at the same moment", async () => {
    const fx = await makeQuiz();
    const userId = await makeUser(db);
    const t0 = new Date();
    await startAttempt(userId, fx.quiz.id, t0);
    for (let i = 0; i < 10; i++) await saveAnswer(userId, fx.quiz.id, fx.questionId(i), fx.right(i).id, t0);
    const at = new Date(t0.getTime() + 30_000);
    const results = await Promise.all([
      submitAttempt(userId, fx.quiz.id, at),
      submitAttempt(userId, fx.quiz.id, at),
      submitAttempt(userId, fx.quiz.id, new Date(at.getTime() + 5_000)),
    ]);
    expect(results.map((r) => r?.coinsAwarded)).toEqual([100, 100, 100]);
    expect(await submitAttempt(userId, fx.quiz.id, new Date(t0.getTime() + 90_000))).toMatchObject({
      timeTakenSeconds: expect.any(Number),
      coinsAwarded: 100,
    });
    expect(await coinBalance(userId)).toBe(100);
    expect(await db.coinLedger.count({ where: { reason: "earn_quiz" } })).toBe(1);
    // The recorded time is from the first close, not a later submit.
    const attempt = await db.quizAttempt.findFirstOrThrow();
    expect([30, 35]).toContain(attempt.timeTakenSeconds);
  });

  it("returns null for a user with no attempt", async () => {
    const fx = await makeQuiz();
    expect(await submitAttempt(await makeUser(db), fx.quiz.id)).toBeNull();
  });
});

describe("what the player is sent", () => {
  it("has no correct answers or explanations while playing, and resumes after a refresh", async () => {
    const fx = await makeQuiz();
    const userId = await makeUser(db);
    const t0 = new Date();
    await startAttempt(userId, fx.quiz.id, t0);
    await saveAnswer(userId, fx.quiz.id, fx.questionId(2), fx.wrong(2).id, t0);
    const view = await getQuizPage(userId, fx.quiz.id, new Date(t0.getTime() + 100_000));
    expect(view?.state).toBe("playing");
    if (view?.state !== "playing") return;
    const sent = JSON.stringify(view);
    expect(sent).not.toMatch(/isCorrect|correctOptionId|explanation|Because/);
    expect(view.questions).toHaveLength(10);
    expect(view.questions[0]!.options[0]).toEqual({ id: expect.any(Number), text: "Right" });
    expect(Object.keys(view.questions[0]!.options[0]!).sort()).toEqual(["id", "text"]);
    expect(view.answers).toEqual({ [fx.questionId(2)]: fx.wrong(2).id });
    expect(view.secondsLeft).toBe(QUIZ_SECONDS - 100);
  });

  it("shows a signed-out visitor the quiz as ready, never its questions", async () => {
    const fx = await makeQuiz();
    const view = await getQuizPage(null, fx.quiz.id);
    expect(view?.state).toBe("ready");
    expect(JSON.stringify(view)).not.toMatch(/Question 1|isCorrect/);
  });

  it("shows answers and explanations after submitting", async () => {
    const fx = await makeQuiz();
    const userId = await makeUser(db);
    await play(userId, fx, 3, new Date());
    const view = await getQuizPage(userId, fx.quiz.id);
    expect(view?.state).toBe("finished");
    if (view?.state !== "finished") return;
    expect(view.result).toMatchObject({ score: 30, correctCount: 3, coinsAwarded: 0 });
    expect(view.review[0]).toMatchObject({
      explanation: "Because 1",
      correctOptionId: fx.right(0).id,
      chosenOptionId: fx.right(0).id,
    });
    expect(view.review[9]).toMatchObject({ correctOptionId: fx.right(9).id, chosenOptionId: fx.wrong(9).id });
  });

  it("closes and scores an attempt whose time ran out when the page is opened", async () => {
    const fx = await makeQuiz();
    const userId = await makeUser(db);
    const t0 = new Date(Date.now() - 10 * 60_000);
    await startAttempt(userId, fx.quiz.id, t0);
    await saveAnswer(userId, fx.quiz.id, fx.questionId(0), fx.right(0).id, t0);
    const view = await getQuizPage(userId, fx.quiz.id);
    expect(view).toMatchObject({ state: "finished", result: { score: 10, timeTakenSeconds: QUIZ_SECONDS } });
  });

  it("shows a quiz that hasn't opened or has closed, and the player's result after it closes", async () => {
    const fx = await makeQuiz();
    const userId = await makeUser(db);
    await play(userId, fx, 4, new Date());
    const before = new Date(Date.now() - 2 * DAY);
    const after = new Date(Date.now() + 7 * DAY);
    expect(await getQuizPage(null, fx.quiz.id, before)).toMatchObject({ state: "upcoming", quiz: { id: fx.quiz.id } });
    expect(await getQuizPage(null, fx.quiz.id, after)).toMatchObject({ state: "closed", quiz: { id: fx.quiz.id } });
    expect(await getQuizPage(userId, fx.quiz.id, after)).toMatchObject({ state: "finished", result: { score: 40 } });
  });

  it("has no page for drafts, unscheduled quizzes, ones without 10 questions or unknown ids", async () => {
    const drafts = await Promise.all([
      makeQuiz({ active: false }),
      makeQuiz({ scheduled: false }),
      makeQuiz({ questions: 9 }),
    ]);
    for (const fx of drafts) expect(await getQuizPage(null, fx.quiz.id)).toBeNull();
    expect(await getQuizPage(null, 2_000_000_000)).toBeNull();
  });
});

describe("the /quiz boxes", () => {
  it("lets any open quiz be started when several are open at once", async () => {
    const first = await makeQuiz();
    const second = await makeQuiz();
    const userId = await makeUser(db);
    expect(await startAttempt(userId, first.quiz.id)).toMatchObject({ ok: true });
    expect(await startAttempt(userId, second.quiz.id)).toMatchObject({ ok: true });
  });

  it("groups open and upcoming quizzes by category in the admin's order, with no category last", async () => {
    const now = new Date();
    const later = await db.quizCategory.create({ data: { key: "t-later", name: "Herbs", sortOrder: 20, glyph: "औ" } });
    const sooner = await db.quizCategory.create({ data: { key: "t-sooner", name: "Doshas", sortOrder: 10 } });
    const hidden = await db.quizCategory.create({ data: { key: "t-hidden", name: "Hidden", sortOrder: 5, active: false } });
    const herbs = await makeQuiz({ now });
    const upcoming = await makeQuiz({ now: new Date(now.getTime() + 3 * DAY) });
    const doshas = await makeQuiz({ now });
    const loose = await makeQuiz({ now });
    const inHidden = await makeQuiz({ now });
    const ended = await makeQuiz({ now: new Date(now.getTime() - 10 * DAY) });
    const draft = await makeQuiz({ now, active: false });
    await db.quiz.update({ where: { id: herbs.quiz.id }, data: { categoryId: later.id } });
    // Upcoming quiz in the same category, listed after the open one even though it was made first.
    await db.quiz.update({ where: { id: upcoming.quiz.id }, data: { categoryId: later.id, glyph: "वा" } });
    await db.quiz.update({ where: { id: doshas.quiz.id }, data: { categoryId: sooner.id } });
    await db.quiz.update({ where: { id: inHidden.quiz.id }, data: { categoryId: hidden.id } });
    await db.quiz.update({ where: { id: draft.quiz.id }, data: { categoryId: sooner.id } });
    await db.quiz.update({ where: { id: ended.quiz.id }, data: { categoryId: sooner.id } });

    const groups = await listQuizGroups(null, now);
    expect(groups.map((group) => [group.name, group.quizzes.map((quiz) => quiz.id)])).toEqual([
      ["Doshas", [doshas.quiz.id]],
      ["Herbs", [herbs.quiz.id, upcoming.quiz.id]],
      [null, [loose.quiz.id, inHidden.quiz.id]],
    ]);
    const [, herbGroup] = groups;
    expect(herbGroup!.quizzes.map((quiz) => [quiz.open, quiz.glyph])).toEqual([
      [true, "औ"],
      [false, "वा"],
    ]);
    // Nothing about questions or answers is in the list.
    expect(JSON.stringify(groups)).not.toMatch(/Question 1|Right|isCorrect/);
  });

  it("marks the viewer's own quizzes as in progress or played", async () => {
    const playing = await makeQuiz();
    const done = await makeQuiz();
    await makeQuiz();
    const userId = await makeUser(db);
    await startAttempt(userId, playing.quiz.id);
    await play(userId, done, 5, new Date());
    const [group] = await listQuizGroups(userId);
    const played = new Map(group!.quizzes.map((quiz) => [quiz.id, quiz.played]));
    expect(played.get(playing.quiz.id)).toBe("playing");
    expect(played.get(done.quiz.id)).toBe("done");
    expect([...played.values()].filter((value) => value === null)).toHaveLength(1);
    expect((await listQuizGroups(null))[0]!.quizzes.every((quiz) => quiz.played === null)).toBe(true);
  });

  it("is empty with no published quiz open or coming", async () => {
    await makeQuiz({ active: false });
    expect(await listQuizGroups(null)).toEqual([]);
  });
});

describe("leaderboards", () => {
  const now = new Date();

  it("ranks by score, then time, with first name and last initial only", async () => {
    const fx = await makeQuiz();
    const mk = async (name: string, correct: number, seconds: number) => {
      const id = await makeUser(db);
      await db.user.update({ where: { id }, data: { name } });
      await play(id, fx, correct, now, seconds);
      return id;
    };
    await mk("Asha Rao", 8, 120);
    await mk("Bharat Kumar Singh", 9, 200);
    await mk("Chitra Menon", 8, 100);
    const board = await readLeaderboard("week", null, now);
    expect(board.rows.map((r) => [r.rank, r.name, r.score, r.seconds])).toEqual([
      [1, "Bharat S.", 90, 200],
      [2, "Chitra M.", 80, 100],
      [3, "Asha R.", 80, 120],
    ]);
    expect(board.you).toBeNull();
    const sent = JSON.stringify(board);
    expect(sent).not.toMatch(/Rao|Menon|Singh|user-|example\.test/);
  });

  it("marks and ranks the signed-in user, even outside the shown rows", async () => {
    const fx = await makeQuiz();
    for (let i = 0; i < 21; i++) await play(await makeUser(db), fx, 10, now, 10 + i);
    const me = await makeUser(db);
    await play(me, fx, 1, now, 50);
    const board = await readLeaderboard("week", me, now);
    expect(board.rows).toHaveLength(20);
    expect(board.rows.some((r) => r.isYou)).toBe(false);
    expect(board.you).toMatchObject({ rank: 22, score: 10, isYou: true });
  });

  it("counts only finished attempts, and adds the month's quizzes together", async () => {
    // Wed 14 Oct 2026, 11:30 IST. Quiz one ran Fri 2 Oct (this month, not this week).
    const today = new Date("2026-10-14T06:00:00.000Z");
    const earlierStart = new Date("2026-10-02T04:00:00.000Z");
    const earlier = await makeQuiz({ now: earlierStart });
    const current = await makeQuiz({ now: today });
    const userId = await makeUser(db);
    await play(userId, earlier, 5, earlierStart, 100);
    await play(userId, current, 4, today, 100);
    const week = await readLeaderboard("week", userId, today);
    const month = await readLeaderboard("month", userId, today);
    expect(week.you).toMatchObject({ rank: 1, score: 40, seconds: 100 });
    expect(month.you).toMatchObject({ rank: 1, score: 90, seconds: 200 });
    // An attempt that is still open isn't on the board.
    const other = await makeUser(db);
    const third = await makeQuiz({ now: today });
    await startAttempt(other, third.quiz.id, today);
    expect((await readLeaderboard("week", other, today)).you).toBeNull();
  });

  it("is empty with no attempts", async () => {
    const board = await readLeaderboard("month", null, now);
    expect(board.rows).toEqual([]);
    expect(board.you).toBeNull();
  });
});
