// Strings for Quiz & Win (P2.3): /quiz, /quiz/leaderboard and the homepage
// section. Keep user-facing text here so Hindi can be added later.

const count = (n: number) => new Intl.NumberFormat("en-IN").format(n);

export const quiz = {
  metaTitle: "Quiz & Win",
  carousel: {
    label: "Quiz & Win highlights",
    play: {
      kicker: "Quiz & Win",
      title: "Learn Ayurveda.",
      emphasis: "Earn rewards.",
      cta: "Play this week's quiz",
      ctaNone: "See when the next quiz opens",
    },
    board: {
      kicker: "Leaderboard",
      title: "Top the leaderboard.",
      emphasis: "Earn Saatvik Coins.",
      cta: "View the rankings",
    },
  },
  challenge: "Weekly challenge",
  board: {
    eyebrow: "Leaderboard",
    title: "Top scores this week",
    titleMonth: "Top scores this month",
    note: "Ranked by score first, then by time taken. Only first names and a last initial are shown.",
    full: "See full leaderboard",
  },
  title: "How strong is your Ayurveda knowledge?",
  facts: (questions: number, minutes: number) => `${questions} questions • ${minutes} minutes • One attempt`,
  endsOn: (when: string) => `Open until ${when}`,
  rules: [
    "The timer starts when you press Start and keeps running if you leave or refresh.",
    "Your answers are saved as you choose them. Answers after the time is up are not counted.",
    "You can play each weekly quiz once.",
  ],
  coinsLine: (coins: number, percent: number) =>
    coins > 0 ? `Score ${percent}% or more to earn ${count(coins)} Saatvik Coins.` : null,
  signIn: "Sign in to play",
  signInNote: "You need an account to play and to appear on the leaderboard.",
  start: "Start quiz",
  starting: "Starting…",
  none: {
    title: "No quiz is open right now",
    description: "A new quiz opens every week.",
    next: (when: string) => `Next quiz starts ${when}.`,
    noneScheduled: "The next quiz hasn't been scheduled yet. Check back soon.",
  },
  play: {
    timeLeft: "Time left",
    timerLabel: (time: string) => `Time left: ${time}`,
    question: (n: number, total: number) => `Question ${n} of ${total}`,
    points: (n: number) => `${n} ${n === 1 ? "point" : "points"}`,
    answered: (done: number, total: number) => `${done} of ${total} answered`,
    submit: "Submit answers",
    submitting: "Submitting…",
    unanswered: (n: number) => `${n} ${n === 1 ? "question is" : "questions are"} not answered yet.`,
    saveError: "That answer could not be saved. Check your connection and choose it again.",
    timeUp: "Time is up. Your answers are being scored.",
  },
  result: {
    title: "Your result",
    score: (score: number, max: number) => `${count(score)} / ${count(max)} points`,
    correct: (n: number, total: number) => `${n} of ${total} correct`,
    time: (time: string) => `Time taken ${time}`,
    earned: (coins: number) => `You earned ${count(coins)} Saatvik Coins.`,
    notEarned: (percent: number) => `Score ${percent}% or more to earn coins. Better luck next week.`,
    review: "Answers and explanations",
    yourAnswer: "Your answer",
    correctAnswer: "Correct answer",
    noAnswer: "You didn't answer this question.",
    right: "Correct",
    wrong: "Not correct",
    leaderboard: "See the leaderboard",
    coins: "My Saatvik Coins",
  },
  leaderboard: {
    metaTitle: "Quiz leaderboard",
    eyebrow: "QUIZ & WIN",
    title: "Leaderboard",
    description: "Ranked by points, then by the time taken. Only first names and a last initial are shown.",
    periodsLabel: "Period",
    periods: { week: "This week", month: "This month" },
    columns: { rank: "Rank", name: "Name", score: "Points", time: "Time" },
    you: "You",
    empty: "No one has finished a quiz in this period yet.",
    yourRank: (rank: number) => `Your rank: ${count(rank)}`,
    notRanked: "You haven't finished a quiz in this period.",
    play: "Play this week's quiz",
    back: "Back to Quiz & Win",
  },
  home: {
    open: "Play now",
    live: "This week's quiz",
    endsOn: (when: string) => `Open until ${when}`,
    next: (when: string) => `Next quiz starts ${when}`,
    noneScheduled: "The next quiz will be announced soon.",
    leaderboard: "Leaderboard",
  },
} as const;

/** "4:05" for 245 seconds. */
export function clock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
