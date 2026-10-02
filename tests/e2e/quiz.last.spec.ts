import { randomBytes } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { admin } from "../../src/content/admin";
import { coins } from "../../src/content/coins";
import { quiz } from "../../src/content/quiz";
import { E2E_EMAIL_DOMAIN, E2E_QUIZ_PREFIX, e2eDb, signInAs } from "./auth-helpers";
import { axeViolations, collectErrors, horizontalOverflow } from "./helpers";

// Quiz & Win (P2.3), end to end: a play-through with coins, resuming after a
// refresh, running out of time, and the leaderboards. Only one quiz is open
// at a time and the homepage shows it, so the file runs in the "-last"
// projects, after the exclusive ones (see playwright.config.ts). Quizzes are titled "E2E ..." and
// removed by tests/e2e/cleanup.ts (attempts go with them).

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await e2eDb().quiz.deleteMany({ where: { title: { startsWith: E2E_QUIZ_PREFIX } } });
});

test.afterEach(async () => {
  await e2eDb().quiz.deleteMany({ where: { title: { startsWith: E2E_QUIZ_PREFIX } } });
});

const DAY = 24 * 60 * 60 * 1000;

/** A 10-question quiz open for the week (first option of each question is right). */
async function openQuiz(options: { startsInDays?: number } = {}) {
  const offset = (options.startsInDays ?? -1) * DAY;
  const title = `${E2E_QUIZ_PREFIX}Quiz ${randomBytes(3).toString("hex")}`;
  const created = await e2eDb().quiz.create({
    data: {
      title,
      active: true,
      passPercent: 60,
      startsAt: new Date(Date.now() + offset),
      endsAt: new Date(Date.now() + offset + 7 * DAY),
      questions: {
        create: Array.from({ length: 10 }, (_, i) => ({
          sortOrder: (i + 1) * 10,
          prompt: `E2E question ${i + 1}?`,
          points: 10,
          explanation: `E2E explanation ${i + 1}`,
          options: {
            create: [
              { sortOrder: 10, text: "Right answer", isCorrect: true },
              { sortOrder: 20, text: "Wrong answer", isCorrect: false },
            ],
          },
        })),
      },
    },
  });
  return { id: created.id, title };
}

const question = (page: Page, n: number) =>
  page.getByRole("group", { name: quiz.play.question(n, 10) });

async function answer(page: Page, n: number, right: boolean) {
  await question(page, n)
    .getByLabel(right ? "Right answer" : "Wrong answer")
    .check();
}

test("play through: answers, score, coins once, explanations, leaderboard", async ({ page, baseURL }) => {
  const errors = collectErrors(page);
  const open = await openQuiz();
  const user = await signInAs(page, baseURL!, { role: "user", name: "Meera Kulkarni" });

  // The homepage shows the live quiz.
  await page.goto("/");
  const section = page.locator("#quiz");
  await expect(section.getByRole("heading", { name: open.title })).toBeVisible();
  await section.getByRole("link", { name: quiz.home.open }).click();

  await expect(page).toHaveURL(/\/quiz$/);
  await expect(page.getByRole("heading", { level: 1, name: open.title })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  // No questions before starting.
  await expect(page.getByText("E2E question 1?")).toHaveCount(0);

  await page.getByRole("button", { name: quiz.start }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(question(page, 10)).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  // No answer key in the page the player is given.
  const html = await page.content();
  expect(html).not.toContain("E2E explanation");
  expect(html).not.toContain("isCorrect");

  for (let n = 1; n <= 10; n++) await answer(page, n, n <= 7);
  await expect(page.getByText(quiz.play.answered(10, 10))).toBeVisible();
  await page.getByRole("button", { name: quiz.play.submit }).click();

  await expect(page.getByRole("heading", { name: quiz.result.title })).toBeVisible();
  await expect(page.getByText(quiz.result.score(70, 100))).toBeVisible();
  await expect(page.getByText(quiz.result.correct(7, 10))).toBeVisible();
  await expect(page.getByText(quiz.result.earned(100))).toBeVisible();
  const review = page.getByTestId("quiz-review");
  await expect(review).toHaveCount(10);
  await expect(review.first()).toContainText("E2E explanation 1");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  // A refresh shows the same result and credits nothing more.
  await page.reload();
  await expect(page.getByText(quiz.result.earned(100))).toBeVisible();
  const rows = await e2eDb().coinLedger.findMany({ where: { userId: user.id } });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ reason: "earn_quiz", amount: 100 });

  // The coins show in the history.
  await page.goto("/coins");
  await expect(page.getByText(coins.history.reason.earn_quiz())).toBeVisible();

  // Second visit to start is a no-op: still one attempt.
  await page.goto("/quiz");
  await expect(page.getByRole("button", { name: quiz.start })).toHaveCount(0);
  expect(await e2eDb().quizAttempt.count({ where: { userId: user.id } })).toBe(1);

  // Leaderboard: first name and last initial, and the user's own rank.
  await page.goto("/quiz/leaderboard");
  await expect(page.getByRole("heading", { level: 1, name: quiz.leaderboard.title })).toBeVisible();
  await expect(page.getByTestId("your-rank")).toContainText(quiz.leaderboard.yourRank(1));
  const row = page.getByTestId("leaderboard-row").first();
  await expect(row).toContainText("Meera K.");
  await expect(page.locator("main")).not.toContainText("Kulkarni");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("a refresh keeps the answers and the timer; late answers are not counted", async ({ page, baseURL }) => {
  const errors = collectErrors(page);
  await openQuiz();
  const user = await signInAs(page, baseURL!, { role: "user" });

  await page.goto("/quiz");
  await page.getByRole("button", { name: quiz.start }).click();
  await answer(page, 1, true);
  await answer(page, 2, true);
  await answer(page, 3, false);
  await expect(page.getByText(quiz.play.answered(3, 10))).toBeVisible();

  // Saved on the server one at a time: wait for all three, then refresh.
  await expect
    .poll(async () => {
      const attempt = await e2eDb().quizAttempt.findFirst({ where: { userId: user.id } });
      return Object.keys((attempt?.answers as Record<string, number> | undefined) ?? {}).length;
    })
    .toBe(3);
  await page.reload();
  await expect(page.getByText(quiz.play.answered(3, 10))).toBeVisible();
  await expect(question(page, 1).getByLabel("Right answer")).toBeChecked();
  await expect(question(page, 3).getByLabel("Wrong answer")).toBeChecked();
  await expect(page.getByRole("timer")).toBeVisible();

  // The server's clock decides: move the start back so the time is up.
  await e2eDb().quizAttempt.updateMany({
    where: { userId: user.id },
    data: { startedAt: new Date(Date.now() - 6 * 60_000) },
  });
  await answer(page, 4, true);
  await expect(page.getByRole("heading", { name: quiz.result.title })).toBeVisible();
  // Two right answers were in time; the late one (and the rest) don't count.
  await expect(page.getByText(quiz.result.score(20, 100))).toBeVisible();
  await expect(page.getByText(quiz.result.notEarned(60))).toBeVisible();
  const attempt = await e2eDb().quizAttempt.findFirstOrThrow({ where: { userId: user.id } });
  expect(Object.keys(attempt.answers as object)).toHaveLength(3);
  expect(attempt).toMatchObject({ score: 20, timeTakenSeconds: 300, coinsAwarded: 0 });
  expect(await e2eDb().coinLedger.count({ where: { userId: user.id } })).toBe(0);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("a quiz left unfinished is scored when time runs out, on the next visit", async ({ page, baseURL }) => {
  await openQuiz();
  const user = await signInAs(page, baseURL!, { role: "user" });
  await page.goto("/quiz");
  await page.getByRole("button", { name: quiz.start }).click();
  for (let n = 1; n <= 6; n++) await answer(page, n, true);
  await expect(page.getByText(quiz.play.answered(6, 10))).toBeVisible();
  await expect
    .poll(async () => {
      const attempt = await e2eDb().quizAttempt.findFirst({ where: { userId: user.id } });
      return Object.keys((attempt?.answers as object | undefined) ?? {}).length;
    })
    .toBe(6);
  await e2eDb().quizAttempt.updateMany({
    where: { userId: user.id },
    data: { startedAt: new Date(Date.now() - 20 * 60_000) },
  });
  await page.goto("/quiz");
  await expect(page.getByText(quiz.result.score(60, 100))).toBeVisible();
  await expect(page.getByText(quiz.result.earned(100))).toBeVisible();
});

test("signed out: the quiz can be read but needs sign-in; no quiz open shows the next start", async ({ page }) => {
  await openQuiz();
  await page.goto("/quiz");
  await expect(page.getByRole("link", { name: quiz.signIn })).toBeVisible();
  await expect(page.getByRole("button", { name: quiz.start })).toHaveCount(0);
  await expect(page.getByText("E2E question 1?")).toHaveCount(0);
  expect(await axeViolations(page)).toEqual([]);

  await e2eDb().quiz.deleteMany({ where: { title: { startsWith: E2E_QUIZ_PREFIX } } });
  await openQuiz({ startsInDays: 3 });
  await page.goto("/");
  await expect(page.locator("#quiz").getByText(/Next quiz starts/)).toBeVisible();
  await expect(page.locator("#quiz").getByRole("button", { name: quiz.home.open })).toBeDisabled();
  await page.goto("/quiz");
  await expect(page.getByRole("heading", { name: quiz.none.title })).toBeVisible();
  await expect(page.getByText(/Next quiz starts/)).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
});

test("leaderboards: ranked by score then time, short names, own rank", async ({ page, baseURL }) => {
  const errors = collectErrors(page);
  const open = await openQuiz();
  const db = e2eDb();
  const type = await db.userType.findUniqueOrThrow({ where: { key: "customer" } });
  const others = [
    { name: "Anil Deshpande", score: 90, seconds: 200 },
    { name: "Bina Shah", score: 80, seconds: 90 },
    { name: "Chetan Rao", score: 80, seconds: 150 },
  ];
  for (const other of others) {
    const id = randomBytes(12).toString("base64url");
    await db.user.create({
      data: {
        id,
        name: other.name,
        email: `e2e-${id}@${E2E_EMAIL_DOMAIN}`,
        emailVerified: true,
        userTypeId: type.id,
        termsAcceptedAt: new Date(),
      },
    });
    await db.quizAttempt.create({
      data: {
        userId: id,
        quizId: open.id,
        answers: {},
        submittedAt: new Date(),
        score: other.score,
        maxScore: 100,
        correctCount: other.score / 10,
        timeTakenSeconds: other.seconds,
      },
    });
  }
  const me = await signInAs(page, baseURL!, { role: "user", name: "Dev Patil" });
  await db.quizAttempt.create({
    data: {
      userId: me.id,
      quizId: open.id,
      answers: {},
      submittedAt: new Date(),
      score: 80,
      maxScore: 100,
      correctCount: 8,
      timeTakenSeconds: 120,
    },
  });

  await page.goto("/quiz/leaderboard");
  const rows = page.getByTestId("leaderboard-row");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Anil D.");
  await expect(rows.nth(1)).toContainText("Bina S.");
  await expect(rows.nth(2)).toContainText("Dev P.");
  await expect(rows.nth(2)).toContainText(quiz.leaderboard.you);
  await expect(rows.nth(3)).toContainText("Chetan R.");
  await expect(page.getByTestId("your-rank")).toContainText(quiz.leaderboard.yourRank(3));
  await expect(page.locator("main")).not.toContainText("Deshpande");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);

  await page.getByRole("link", { name: quiz.leaderboard.periods.month }).click();
  await expect(page).toHaveURL(/period=month/);
  await expect(page.getByRole("link", { name: quiz.leaderboard.periods.month })).toHaveAttribute("aria-current", "page");
  await expect(rows).toHaveCount(4);
  expect(await axeViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("admin: the quiz form has the week and pass mark", async ({ page, baseURL }) => {
  await signInAs(page, baseURL!, { role: "admin" });
  await page.goto("/admin/content/quiz/new");
  const text = admin.quiz.form;
  await expect(page.getByLabel(text.startsAt)).toBeVisible();
  await expect(page.getByLabel(text.endsAt)).toBeVisible();
  await expect(page.getByLabel(text.passPercent)).toHaveValue("60");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await axeViolations(page)).toEqual([]);
});
