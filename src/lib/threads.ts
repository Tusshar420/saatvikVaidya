// Thread (Dr. Talk) rules shared by the server and the pages. Text lives in
// src/content/threads.ts.

export const threadKinds = ["question", "case_discussion", "expert_talk"] as const;
export type ThreadKind = (typeof threadKinds)[number];

export const threadFilters = ["latest", ...threadKinds] as const;
export type ThreadFilter = (typeof threadFilters)[number];

export function isThreadFilter(value: unknown): value is ThreadFilter {
  return threadFilters.includes(value as ThreadFilter);
}

export const threadLimits = { title: 160, body: 5000, reply: 2000, page: 20 } as const;

/** A poll has 2 to 6 choices of up to 120 characters; the thread title is the question. */
export const pollLimits = { min: 2, max: 6, option: 120 } as const;

/** Only approved Ayurveda doctors post and reply; everyone signed in reads and likes. */
export function canWriteThreads(user: {
  userTypeKey: string;
  verificationStatus: string;
}): boolean {
  return user.userTypeKey === "doctor" && user.verificationStatus === "approved";
}

export type ThreadAuthor = { name: string; isDoctor: boolean };

export type ThreadView = {
  id: number;
  kind: ThreadKind;
  title: string;
  body: string;
  author: ThreadAuthor;
  createdAt: string;
  replyCount: number;
  likeCount: number;
  likedByMe: boolean;
  poll: PollView | null;
};

export type PollView = {
  options: { id: number; label: string; votes: number }[];
  totalVotes: number;
  /** The option this viewer voted for, if any. */
  myOptionId: number | null;
  /** Results show once the viewer has voted, and always to the thread's author. */
  showResults: boolean;
};

/** Whole-number percentage of the votes; 0 when nobody has voted. */
export function pollPercent(votes: number, total: number): number {
  return total === 0 ? 0 : Math.round((votes / total) * 100);
}

export type ReplyView = {
  id: number;
  body: string;
  author: ThreadAuthor;
  createdAt: string;
};
